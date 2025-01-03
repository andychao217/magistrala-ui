const protocol = window.location.protocol,
      hostname = window.location.hostname,
      filesModal = new bootstrap.Modal(document.getElementById("filesModal")), // 文件弹框
      $filesModalTable = $('#filesModalTable'), // 文件弹框表格
      playAreasModal = new bootstrap.Modal(document.getElementById("playAreasModal")), // 播放区域弹框
      $playAreasModalTable = $('#playAreasModalTable'), // 播放区域弹框表格
      domainID = sessionStorage.getItem("domainID"), // 当前机构ID
      userInfoStr = sessionStorage.getItem("userInfo"),
      userInfo = JSON.parse(userInfoStr),
      socketBridgePort =  sessionStorage.getItem("socketBridgePort") || "63001",
      minioBridgePort =  sessionStorage.getItem("minioBridgePort") || "9102"; // 获取minio桥接端口

let comID = "", // 当前通信ID
    curPlaylist = [], //当前文件播放列表
    breadCrumbFolderList = [], //当前选中文件夹列表-文件弹框
    isPlaying = false, //当前是否正在播放
    isBroadCasting = false, //当前是否正在广播
    selectedPlayAreaList = [], //当前选中的播放区域
    playAreaTreeData = [], // 播放区域树数据
    allThingsList = [], // 所有设备列表
    curSeceneData = {}, // 当前场景数据
    curBroadcastingData = {}, // 当前广播数据
    currentFolderKey = "", //当前文件夹key-文件弹框
    playerElapsed = 0, //当前播放进度
    playerProgressInterval = null; // 播放进度定时器

$(document).ready(function() {
    initPage();
    $filesModalTable.bootstrapTable({});
    $filesModalTable.removeClass('table-bordered');
    $playAreasModalTable.bootstrapTable({
        selectItemName: 'selectedRows',
        onCheck: function(row, $element) {
            selectedPlayAreaList.push(row);
            selectedPlayAreaList = _.uniqBy(selectedPlayAreaList, 'id');
        },
        onUncheck: function(row, $element) {
            selectedPlayAreaList = selectedPlayAreaList.filter(item => item.id !== row.id);
        },
        onCheckAll: function(e) {
            selectedPlayAreaList = [
                ...selectedPlayAreaList,
                ...$playAreasModalTable.bootstrapTable('getData'),
            ];
            selectedPlayAreaList = _.uniqBy(selectedPlayAreaList, 'id');
        },
        onUncheckAll: function(e) {
            selectedPlayAreaList = selectedPlayAreaList.filter(itemA => 
                !$playAreasModalTable.bootstrapTable('getData').some(itemB => itemB.id === itemA.id)
            );
        }
    });
    $playAreasModalTable.removeClass('table-bordered');

    //点击全选按钮时，全选或取消全选
    $('#play-area-select-unselect-all-btn').click(function() {
        if (selectedPlayAreaList.length) {
            selectedPlayAreaList = [];
        } else {
            selectedPlayAreaList = _.cloneDeep(allThingsList);
        }
        updatePlayAreaSelectBtnStatus();
    });

    // 点击添加文件按钮打开文件弹框
    $('#addSourceModalFileBtn').click(function() {
        filesModal.show();
        loadFilesTable("");
    });

    // 文件弹框中点击确认按钮时，隐藏文件弹框并更新音源弹框中的文件列表
    $('#confirmFileBtn').click(function() {
        filesModal.hide();
        const selectedRows = $filesModalTable.bootstrapTable('getSelections');
        curPlaylist = [
            ...curPlaylist,
            ...selectedRows,
        ];
        createPlaylistDom();
    });

    //点击播放按钮时，开始、暂停播放
    $('#playlist-play-pause-btn').click(function() {
        $(this).empty();
        if (isBroadCasting) {
            const soundConsoleTaskControl = {
                username: curBroadcastingData.username,
                uuid: curBroadcastingData.uuid,
                command: isPlaying ? 2 : 3,
            }
            const data = {
                controlType:  "soundConsleTaskControl", 
                thingIdentity: curBroadcastingData.thingIdentity, 
                username: soundConsoleTaskControl.username,
                uuid: soundConsoleTaskControl.uuid,
                soundConsoleTaskControl
            };
            controlThingBroadcast("soundConsleTaskControl", data);

            if (isPlaying) {
                //定时器设置播放进度
                playerProgressInterval = setInterval(() => {
                    playerElapsed += 1000;
                    $('#broadcast-page-player-range').val(playerElapsed);
                }, 1000);
            } else {
                clearInterval(playerProgressInterval);
                playerProgressInterval = null;
            }
            isPlaying = !isPlaying;
            updatePlayerPlayPauseBtnStatus();
        }
    });

    //点击播放上一曲按钮
    $('#playlist-play-prev-btn').click(function() {
        if (isBroadCasting) {
            const soundConsoleTaskControl = {
                username: curBroadcastingData.username,
                uuid: curBroadcastingData.uuid,
                command: 5,
            }
            const data = {
                controlType:  "soundConsleTaskControl", 
                thingIdentity: curBroadcastingData.thingIdentity, 
                username: soundConsoleTaskControl.username,
                uuid: soundConsoleTaskControl.uuid,
                soundConsoleTaskControl
            };
            controlThingBroadcast("soundConsleTaskControl", data);
        }
    });

    //点击播放下一曲按钮
    $('#playlist-play-next-btn').click(function() {
        if (isBroadCasting) {
            const soundConsoleTaskControl = {
                username: curBroadcastingData.username,
                uuid: curBroadcastingData.uuid,
                command: 4,
            }
            const data = {
                controlType:  "soundConsleTaskControl", 
                thingIdentity: curBroadcastingData.thingIdentity, 
                username: soundConsoleTaskControl.username,
                uuid: soundConsoleTaskControl.uuid,
                soundConsoleTaskControl
            };
            controlThingBroadcast("soundConsleTaskControl", data);
        }
    });

    //拖动歌曲进度条
    $('#broadcast-page-player-range').change(function() {
        if (isBroadCasting) {
            const soundConsoleTaskControl = {
                username: curBroadcastingData.username,
                uuid: curBroadcastingData.uuid,
                command: 6,
                position: Number($(this).val()),
            }
            const data = {
                controlType:  "soundConsleTaskControl", 
                thingIdentity: curBroadcastingData.thingIdentity, 
                username: soundConsoleTaskControl.username,
                uuid: soundConsoleTaskControl.uuid,
                soundConsoleTaskControl
            };
            controlThingBroadcast("soundConsleTaskControl", data);
        }
    });

    //开始广播
    $('#broadcast-start-stop-btn').click(function() {
        curBroadcastingData = {};
        saveSeceneData().then(task => {
            const uuid = task.uuid + '_1';
            if (isBroadCasting) {
                // 处理广播停止逻辑
                // 1、给发送端发停止消息
                const data = {
                    controlType:  "taskStop", 
                    thingIdentity: task.input_devicName, 
                    username: task.username,
                    uuid,
                };
                controlThingBroadcast("taskStop", data);
                // 2、给接收通道发停止消息
                const out_channel_array = task.out_channel.split(',');
                const out_channel_unique_array = [...new Set(out_channel_array.map((item) => item.split('_')[0]))];
                out_channel_unique_array.forEach(channelID => {
                    const data = {
                        controlType:  "taskStop", 
                        thingIdentity: channelID, 
                        username: task.username,
                        uuid,
                    };
                    controlThingBroadcast("taskStop", data);
                });
                isBroadCasting = false;
                isPlaying = false;
                updateBroadcastBtnStatus();
                updatePlayerPlayPauseBtnStatus();
            } else {
                // 处理广播开始逻辑
                // 输入通道-这⾥要使⽤通道id + 冒号 + ⾳量的形式，多个使⽤英⽂逗号隔开，例如 "1:7,2:4"
                const in_channel_array = task.in_channel.split(',');
                const in_channel_with_voice_array = [];
                in_channel_array.forEach(channelID => {
                    if (channelID) {
                        const volume = task.volume[`in_${Number(channelID)}_volume`];
                        in_channel_with_voice_array.push(`${channelID}:${volume}`);
                    }
                });
                //pa_stream_type取输⼊通道列表的最后⼀个通道的paStreamType
                const inputDevice = allThingsList.find(item => item.credentials.identity === task.input_devicName);
                const pa_stream_type = _.last(inputDevice.metadata?.info?.in_channel?.channel)?.pa_stream_type || 0;
                let stream_push_url = `udp://${inputDevice.metadata?.info?.netcfg?.service_ip}:9105`;
                if (pa_stream_type === 3) {
                    stream_push_url = 'udp://47.106.237.146:7105';
                }
                const data = {
                    controlType:  "taskStart", 
                    thingIdentity: task.input_devicName, 
                    username: task.username,
                    uuid,
                    task: {
                        uuid,
                        username: task.username,
                        name: task.name,
                        priority: 4, //固定设置为4
                        task_type: 11, //调⾳台发送端设置为：SOUND_CONSOLE_REALTIME_SEND_TASK = 11;
                        pa_stream_type,
                        songs: task.songs,
                        in_channel: in_channel_with_voice_array.join(','),
                        out_channel: task.out_channel,
                        voice_volume: 15,
                        song_volume: task.volume.song_volume,
                        master_volume: 15, //固定设置为15
                        start_date: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
                        stream_push_url,
                    }
                };
                curBroadcastingData = _.cloneDeep(data);
                const query = {...data}; 
                delete query.task.out_channel; //发送端不需要out_channel
                controlThingBroadcast("taskStart", query);
            }
        }).catch(error => {
            console.error('Error saving scene data:', error);
        });
    });

    //切换场景
    $('#sceneSelect').change(function() {
        const sceneID = $(this).val();
        getSceneData(sceneID);
    });

    //切换调音设备
    $('#thingsSelect').change(function() {
        createRangeInput();
    });
});

//通过websocket设置歌曲播放器按钮的状态
function setBroadcastingSongPlayerThroughSocketBridge(data) {
    isBroadCasting = true;
    updateBroadcastBtnStatus();
    isPlaying = true;
    updatePlayerPlayPauseBtnStatus();
    $('#broadcast-page-player-range').val(0);
    $('#broadcast-page-player-songLabel').text(data.song)
    $('#broadcast-page-player-range').attr('max', data.duration);
    $('#broadcast-page-player-range').val(data.elapsed || 0);
    playerElapsed = data.elapsed || 0;
    const songLength = formatMilliseconds(data.duration);
    $('#broadcast-page-player-endTime').text(songLength);
    //定时器设置播放进度
    playerProgressInterval = setInterval(() => {
        playerElapsed += 1000;
        $('#broadcast-page-player-range').val(playerElapsed);
    }, 1000);
}

//通过websocket设置任务按钮的播放状态
function setTaskIsBroadcastingThroughSocketBridge(uuid) {
    const sceneID = $('#sceneSelect').val();
    if (uuid.replace('_1', '') === `${comID}${userInfo.credentials.identity}4${sceneID}`) {
        isBroadCasting = true;
        updateBroadcastBtnStatus();
    }
}

//通过websocket发送开始任务命令
function startTaskThroughSocketBridge(uuid) {
    if (curBroadcastingData.uuid && curBroadcastingData.uuid === uuid) {
        // 2、给接收通道发开始任务消息
        const out_channel_array = curBroadcastingData.task.out_channel.split(',');
        const out_channel_unique_array = [...new Set(out_channel_array.map((item) => item.split('_')[0]))];
        out_channel_unique_array.forEach(channelID => {
            const data = {
                controlType:  "taskStart", 
                thingIdentity: channelID, 
                username: curBroadcastingData.username,
                uuid,
                task: {
                    uuid: uuid.replace('_1', '_2'),
                    username: curBroadcastingData.task.username,
                    name: curBroadcastingData.task.name,
                    priority: 4, //固定设置为4
                    task_type: 10,
                    pa_stream_type: 0,
                    out_channel: curBroadcastingData.task.out_channel.
                        split(",").
                        filter(ch => ch.includes(channelID)).
                        map(item => item.split('_')[1]).
                        join(','),
                    stream_pull_url: curBroadcastingData.task?.stream_push_url,
                    startDate: moment(new Date()).format('YYYY-MM-DD HH:mm:ss'),
                }
            };
            controlThingBroadcast("taskStart", data);
        });
        isBroadCasting = true;
        updateBroadcastBtnStatus();
    }
}

//通过websocket发送停止任务命令
function stopTaskThroughSocketBridge(uuid) {
    if (curBroadcastingData.uuid && curBroadcastingData.uuid === uuid) {
        const data = {
            controlType:  "taskStop", 
            thingIdentity: curBroadcastingData.thingIdentity, 
            username: curBroadcastingData.username,
            uuid,
        };
        controlThingBroadcast("taskStop", data);
        // 2、给接收通道发停止消息
        const out_channel_array = curBroadcastingData.task.out_channel.split(',');
        const out_channel_unique_array = [...new Set(out_channel_array.map((item) => item.split('_')[0]))];
        out_channel_unique_array.forEach(channelID => {
            const data = {
                controlType:  "taskStop", 
                thingIdentity: channelID, 
                username: curBroadcastingData.username,
                uuid,
            };
            controlThingBroadcast("taskStop", data);
        });
        isBroadCasting = false;
        isPlaying = false;
        updateBroadcastBtnStatus();
        updatePlayerPlayPauseBtnStatus();
    }
}

// 更新开始、停止广播按钮状态
function updateBroadcastBtnStatus() {
    clearInterval(playerProgressInterval);
    playerProgressInterval = null;
    playerElapsed = 0;
    const $btn = $('#broadcast-start-stop-btn');
    $('#broadcast-page-player-range').attr('disabled', true);
    $('#broadcast-page-player-range').attr('max', 15);
    $('#broadcast-page-player-range').val(0);
    $('#broadcast-page-player-songLabel').text('');
    $('#playlist-play-prev-btn').css('color', 'lightgray');
    $('#playlist-play-pause-btn').css('color', 'lightgray');
    $('#playlist-play-next-btn').css('color', 'lightgray');
    $('#broadcast-page-player-endTime').text('00:00');
    $btn.removeClass('btn-danger').addClass('btn-primary').text('开始广播').attr('title', '开始广播');
    if (isBroadCasting) {
        $('#broadcast-page-player-range').attr('disabled', false);
        $('#playlist-play-prev-btn').css('color', 'black');
        $('#playlist-play-pause-btn').css('color', 'black');
        $('#playlist-play-next-btn').css('color', 'black');
        $btn.removeClass('btn-primary').addClass('btn-danger').text('停止广播').attr('title', '停止广播');
    }
}

// 更新播放器播放、暂停按钮状态
function updatePlayerPlayPauseBtnStatus() {
    const $btn = $('#playlist-play-pause-btn');
    $btn.empty();
    if (isPlaying) {
        const $pauseIcon = $('<i class="fa-solid fa-pause"></i>');
        $btn.append($pauseIcon);
        $btn.attr('title', '暂停');
    } else {
        const $playIcon = $('<i class="fa-solid fa-play"></i>');
        $btn.append($playIcon);
        $btn.attr('title', '播放');
    }
}

//控制设备
function controlThingBroadcast(controlType, controlThingData, callback) {
    if (domainID) {
        if (controlType === "taskStatGet") {
            let queryData = {
                channelID: comID,
                host: hostname,
                comID: comID,
                controlType: controlType,
                uuid: "",
                username: userInfo.credentials.identity,
                task: {},
                deviceInfo: {},
            };
            fetch(`${protocol}//${hostname}:${socketBridgePort}/controlDevice`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": getCookie('session'),
                },
                body: JSON.stringify(queryData)
            });
        } else {
            const data = {
                channelID: comID, 
                ...controlThingData
            }
            postMessage(data, callback);
        }
    } else {
        redirectToLogin();
    }
}

//给设备发信息
function postMessage(data, callback) {
    const queryData = {
        ...data,
        host: hostname,
        comID: data.channelID,
        username: userInfo.credentials.identity,
    }
    fetch(`${protocol}//${hostname}:${socketBridgePort}/controlDevice`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData),
    })
        .then(response => {
            if (callback && typeof callback === 'function') {
                callback();
            }
            console.log("postMessage: ", response)
        })
        .catch((error) => {
            console.error("error postMessage: ", error);
        });
}

// 生成输入通道音量控制条
function createRangeInput() {
    const thingID = $('#thingsSelect').val();
    const thing = allThingsList.find(item => item.id === thingID);
    $('#broadcast-page-volume-control-header').empty();
    $('#broadcast-page-volume-range-container').empty();
    if (thing) {
        const deviceInfo = _.cloneDeep(thing.metadata?.info);
        //输入通道
        if (
            deviceInfo &&
            deviceInfo.in_channel && 
            deviceInfo.in_channel?.channel && 
            deviceInfo.in_channel?.channel?.length
        ) {
            deviceInfo.in_channel?.channel?.filter((channel) => !channel.ignore && channel.aliase !== '收音机').forEach((channel)=>{
                const $channelHeaderItem = $(`
                    <div class="broadcast_volumeFormItemLine-container">
                        <div 
                            class="broadcast_volumeFormItemLine broadcast_volumeFormItemLine_in_channel"
                            data-channel="${channel.id}"
                        ></div>
                        <div style="font-size: 14px;">${channel.aliase}</div>
                    </div>
                `);
                $('#broadcast-page-volume-control-header').append($channelHeaderItem);
                const $channelRangeItem = $(`
                    <div class="broadcast_volumeFormItemLine-container">
                        <div class="range-wrapper speaker-volume-wrapper" style="background: transparent;">
                            <div id="in_channel_rangeInput_label_${channel.id}" class="range-value" style="margin-top: 0px; margin-bottom: 205px;">
                                7
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="15"
                                class="vertical-range rangeInput"
                                value="7"
                                oninput="updateVerticalRangeValue(this)"
                                id="in_channel_rangeInput_${channel.id}"
                            />
                        </div>
                    </div>
                `);
                $('#broadcast-page-volume-range-container').append($channelRangeItem);

                $(`#in_channel_rangeInput_${channel.id}`).on('change', function() {
                    if (isBroadCasting) {
                        const soundConsoleTaskControl = {
                            username: curBroadcastingData.username,
                            uuid: curBroadcastingData.uuid,
                            command: 7,
                            volume_type: Number(channel.id) - 1,
                            volume: Number($(this).val()),
                        }
                        const data = {
                            controlType:  "soundConsleTaskControl", 
                            thingIdentity: curBroadcastingData.thingIdentity, 
                            username: soundConsoleTaskControl.username,
                            uuid: soundConsoleTaskControl.uuid,
                            soundConsoleTaskControl
                        };
                        controlThingBroadcast("soundConsleTaskControl", data);
                    }
                });
            });
        }
        const $channelHeaderFileItem = $(`
            <div class="broadcast_volumeFormItemLine-container">
                <div id="broadcast_volumeFormItemLine_file_checkbox" class="broadcast_volumeFormItemLine selected"></div>
                <div style="font-size: 14px;">文件</div>
            </div>
        `);
        $('#broadcast-page-volume-control-header').append($channelHeaderFileItem);
        const $channelRangeFileItem = $(`
            <div class="broadcast_volumeFormItemLine-container">
                <div class="range-wrapper speaker-volume-wrapper" style="background: transparent;">
                    <div id="in_channel_rangeInput_label_song" class="range-value" style="margin-top: 0px; margin-bottom: 205px;">7</div>
                    <input
                        type="range"
                        min="0"
                        max="15"
                        class="vertical-range rangeInput"
                        value="7"
                        oninput="updateVerticalRangeValue(this)"
                        id="in_channel_rangeInput_song"
                    />
                </div>
            </div>
        `);
        $('#broadcast-page-volume-range-container').append($channelRangeFileItem);

        $(`#in_channel_rangeInput_song`).on('change', function() {
            if (isBroadCasting) {
                const soundConsoleTaskControl = {
                    username: curBroadcastingData.username,
                    uuid: curBroadcastingData.uuid,
                    command: 7,
                    volume_type: 4,
                    volume: Number($(this).val()),
                }
                const data = {
                    controlType:  "soundConsleTaskControl", 
                    thingIdentity: curBroadcastingData.thingIdentity, 
                    username: soundConsoleTaskControl.username,
                    uuid: soundConsoleTaskControl.uuid,
                    soundConsoleTaskControl
                };
                controlThingBroadcast("soundConsleTaskControl", data);
            }
        });
    }
    //不同类型音量开关切换效果
    $('.broadcast_volumeFormItemLine').click(function() {
        $(this).toggleClass('selected');
    });
    initialRangeInputs();
}

// 初始化rangeInput的背景色
function initialRangeInputs () {
    //设置rangeInput的value值时，改变其背景色
    const rangeInputs = document.querySelectorAll('.rangeInput');
    rangeInputs.forEach(rangeInput => {
        rangeInput.addEventListener('input', () => updateRangeBackground(rangeInput));
        updateRangeBackground(rangeInput); // 初始化背景
    });
}

// 获取场景数据
function getSceneData(sceneID) {
    curSeceneData = {};
    selectedPlayAreaList = [];
    curPlaylist = [];
    curBroadcastingData = {};
    isBroadCasting = false;
    isPlaying = false;
    const queryData = {
        comID,
        username: userInfo.credentials.identity,
        uuid: comID + userInfo.credentials.identity + '4' + sceneID,
    };
    fetch(`${protocol}//${hostname}:${socketBridgePort}/getBroadcastTask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData),
    })
        .then(response => {
            updateBroadcastBtnStatus();
            updatePlayAreaSelectBtnStatus();
            updatePlayerPlayPauseBtnStatus();
            createPlaylistDom();
            createRangeInput();
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json().catch(err => {
                //throw new Error('Failed to parse JSON: ' + err);
            });
        })
        .then(json => {
            const task = _.cloneDeep(json?.task || {});
            if (task && task.uuid) {
                const deviceIdentity = task.input_devicName;
                // 调音设备
                const thing = allThingsList.find(item => item.credentials.identity === deviceIdentity);
                const thingID = thing.id;
                $('#thingsSelect').val(thingID);
                // 播放范围
                const out_channel_array = task.out_channel ? task.out_channel.split(',').map((channel)=>{
                    if(channel.includes('_1')){
                        return channel.split('_')[0];
                    } else {
                        return channel;
                    }
                }) : [];
                selectedPlayAreaList = allThingsList.filter(thing => out_channel_array.includes(thing.credentials.identity));
                // 文件列表
                const ossArray = task.songs ? task.songs.split(',') : [];
                // 处理每个元素，生成需要的对象格式
                const resultArray = ossArray.map(item => {
                    // 去掉开头的 "oss://"
                    const key = item.replace("oss://", "");
                    // 提取文件名
                    const fileName = key.substring(key.lastIndexOf('/') + 1);
                    return { fileName, key: `${comID}/${key}` };
                });
                curPlaylist = resultArray.map(item => item);

                updatePlayAreaSelectBtnStatus();
                createPlaylistDom();
                createRangeInput();

                // 音量
                for (let i = 1; i <= 4; i++) {
                    const $div = $(`#in_channel_rangeInput_${i}`),
                          $label = $(`#in_channel_rangeInput_label_${i}`);
                    if ($div && $div.length > 0) {
                        $div.val(task.volume[`in_${i}_volume`]);
                        $label.text(task.volume[`in_${i}_volume`]);
                    }
                }
                const inChannelElements = $('.broadcast_volumeFormItemLine_in_channel');
                inChannelElements.each(function() {
                    // 获取当前元素的 data-channel 属性值
                    const in_channel = $(this).data('channel');
                    if (task.in_channel?.includes(in_channel)) {
                        $(this).addClass('selected');
                    } else {
                        $(this).removeClass('selected');
                    }
                });
                // 文件音量
                $(`#in_channel_rangeInput_song`).val(task.volume[`song_volume`]);
                $(`#in_channel_rangeInput_label_song`).text(task.volume[`song_volume`]);
                if (task.song_enable) {
                    $('#broadcast_volumeFormItemLine_file_checkbox').addClass('selected');
                } else {
                    $('#broadcast_volumeFormItemLine_file_checkbox').removeClass('selected');
                }
                initialRangeInputs();
                controlThingBroadcast("taskStatGet");
            }
        });
}

// 保存场景数据
async function saveSeceneData() {
    const curSecene = $('#sceneSelect').val(),
          curThingID = $('#thingsSelect').val(),
          curThing = allThingsList.find(item => item.id === curThingID);

    //输出通道
    let in_channel_array = [];
    const selectedInChannelElements = $('.broadcast_volumeFormItemLine_in_channel.selected');
    selectedInChannelElements.each(function() {
        // 获取当前元素的 data-channel 属性值
        const in_channel = $(this).data('channel');
        // 将属性值添加到数组中
        in_channel_array.push(in_channel);
    });
    //输出通道
    const out_channel_array = selectedPlayAreaList.map((area) => {
        const identity = area.credentials.identity;
        if (!identity.includes("_")) {
            return `${identity}_1`;
        } else {
            return identity;
        }
    });
    //文件列表
    const songs_array = curPlaylist.map(file => {
        return file.key.replace(`${comID}/`, 'oss://')
    });
    const soundConsoleScene = {
        ...curSeceneData,
        // 场景唯一识别号
        uuid: `${comID}${userInfo.credentials.identity}4${curSecene}`,
        // 场景所属用户
        username: userInfo.credentials.identity,
        // 场景名
        name: "场景" + curSecene,
        // 调音台音量
        volume: {
            ...curSeceneData.volume,
            song_volume: Number($(`#in_channel_rangeInput_song`).val()),
        },
        // 选择的输入通道
        in_channel: in_channel_array.join(','),
        // 选择的输出通道
        out_channel: out_channel_array.join(','),
        // 选择的歌曲列表
        songs: songs_array.join(','),
        // 歌曲通道是否开启
        song_enable: $('#broadcast_volumeFormItemLine_file_checkbox').hasClass('selected'),
        // 调音台输入设备名称
        input_devicName: curThing.credentials.identity,
    }
    for (let i = 1; i <= 4; i++) {
        const $div = $(`#in_channel_rangeInput_${i}`);
        if ($div && $div.length > 0) {
            soundConsoleScene.volume[`in_${i}_volume`] = Number($(`#in_channel_rangeInput_${i}`).val());
        } 
    }

    const queryData = {
        comID,
        username: userInfo.credentials.identity,
        uuid: comID + userInfo.credentials.identity + '4' + curSecene,
        task: soundConsoleScene,
    };
    try {
        const response = await fetch(`${protocol}//${hostname}:${socketBridgePort}/updateBroadcastTask`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": getCookie('session'),
            },
            body: JSON.stringify(queryData),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        // 这里可以处理返回的数据
        const result = await response.json(); // 如果需要处理返回的JSON数据
        return soundConsoleScene;
    } catch (error) {
        console.error('Error saving scene data:', error);
        throw error; // 重新抛出错误
    }
}

// 获取组装播放区域设备树
function getPlayAreaTree() {
    playAreaTreeData = [{
        id: "root",
        key: 'group_root',
        text: "全部",
        flagUrl: null,
        children: [
            {
                id: "unassigned",
                key: "group_unassigned",
                text: "未分区",
                flagUrl: "/images/icon_organization_area.svg",
                metadata: {
                    "thing_ids": []
                },
                children: []
            },
        ]
    }];
    allThingsList = [];
    // 获取所有设备
    fetch(`/ui/things/thingsInJSON?page=1&limit=1000&onlineStatus=2&showFullData=true`, {
        method: "GET",
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); // 直接将流转换为JSON对象
        })
        .then(json => {
            const data = json.data;
            const thingsData = JSON.parse(data).thingsData;
            const things = thingsData.things;
            if (things.length) {
                allThingsList = things.map((thing) => thing);
            }
            // 获取所有分区
            fetch(`/ui/channels/channelsInJSON?page=1&limit=1000`, {
                method: "GET",
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error("Network response was not ok");
                    }
                    return response.json(); // 直接将流转换为JSON对象
                })
                .then((json) => {
                    const data = json.data;
                    const channelsData = JSON.parse(data).channelsData;
                    const channels = channelsData.groups;
                    if (channels.length) {
                        channels.forEach((channel) => {
                            const channelNode = {
                                id: channel.id,
                                text: channel.name,
                                name: channel.name,
                                key: `group_${channel.id}`,
                                flagUrl: "/images/icon_organization_area.svg",
                                metadata: channel.metadata,
                                children: channel.metadata && 
                                    channel.metadata.thing_ids && 
                                    channel.metadata.thing_ids.length ? 
                                        channel.metadata.thing_ids.map((thingId) => {
                                            const targetThing = allThingsList.find((thing) => thingId === thing.id);
                                            if (targetThing && targetThing.id) {
                                                return {
                                                    id: targetThing.id,
                                                    text: targetThing.metadata.aliase,
                                                    name: targetThing.name,
                                                    key: `${targetThing.id}`,
                                                    flagUrl: "/images/icon_channel.png",
                                                    metadata: targetThing.metadata,
                                                    credentials: targetThing.credentials,
                                                }
                                            } else {
                                                return {}
                                            }
                                        }).filter((thing)=>thing.id) : [],
                            };
                            playAreaTreeData[0].children.push(channelNode);
                        });
                        // 获取所有已连接分区的设备ID
                        const allConnectedThingsID = [...new Set(channels.flatMap(channel => {
                            // 检查 channel.metadata 是否存在以及 channel.metadata.thing_ids 是否存在
                            if (channel.metadata && Array.isArray(channel.metadata.thing_ids)) {
                                return channel.metadata.thing_ids;
                            } else {
                                // 如果不存在，返回一个空数组，不会影响 flatMap 的结果
                                return [];
                            }
                        }))];
                        // 获取所有未连接分区的设备
                        const allUnconnectedThings = allThingsList.filter((thing) => !allConnectedThingsID.includes(thing.id)); 
                        // 未分区
                        allUnconnectedThings.forEach((thing) => {
                            const thingNode = {
                                id: thing.id,
                                text: thing.metadata.aliase,
                                name: thing.name,
                                key: `${thing.id}`,
                                flagUrl: "/images/icon_channel.png",
                                metadata: thing.metadata,
                                credentials: thing.credentials,
                            };
                            playAreaTreeData[0].children[0].children.push(thingNode);
                        });
                    } else {
                        //没有分区时，所有设备都属于未分区
                        allThingsList.forEach((thing) => {
                            const thingNode = {
                                id: thing.id,
                                text: thing.metadata.aliase,
                                name: thing.name,
                                key: `${thing.id}`,
                                flagUrl: "/images/icon_channel.png",
                                metadata: thing.metadata,
                                credentials: thing.credentials,
                            };
                            playAreaTreeData[0].children[0].children.push(thingNode);
                        });
                    }
                    createPlayareaChannelsDom();
                    createThingsSelectOptions();
                    createPlaylistDom();
                    updatePlayAreaSelectBtnStatus();
                    initialRangeInputs();
                    updateBroadcastBtnStatus();
                });
        });
}

//生成播放区域分区列表dom
function createPlayareaChannelsDom () {
    const $playareaChannelsContainer = $('#broadcast_playarea_channels_container');
    $playareaChannelsContainer.empty();
    playAreaTreeData[0]?.children.forEach(channel => {
        const $channel = $(`
            <div 
                class="hoverCard card" 
                style="height: 100px;" 
                data-channel_id="${channel.id}"
                id="channel-card-${channel.id}"
            >
                <div class="card-body">
                    <div class="row">
                        <div class="col">
                            <img 
                                loading="lazy" 
                                src="/images/icon_organization_area.svg" 
                                class="hoverCardIcon" 
                                style="height: 24px;"
                            />
                        </div>
                        <div class="col" style="text-align: right;" onclick="event.stopPropagation()">
                            <input 
                                class="form-check-input" 
                                type="checkbox" 
                                value="" 
                                id="channel_checkbox_${channel.id}"
                            />
                        </div>
                    </div>
                    <div class="row">
                        <h5 
                            class="card-title truncate-text" 
                            style="font-size: 15px; font-weight: normal;"
                            title="${channel.text}"
                        >
                            ${channel.text}
                        </h5>
                    </div>
                </div>
            </div>
        `);
        $playareaChannelsContainer.append($channel);
        //点击分区
        $(`#channel-card-${channel.id}`).click(function (event) {
            openPlayareaSelectModal(channel);
        });

        //更新分区选中状态
        const selectedThingsInChannel = selectedPlayAreaList.filter(item1 => 
            channel.children?.some(item2 => item2.id === item1.id)
        );
        const channelCheckbox = $(`#channel_checkbox_${channel.id}`);
        channelCheckbox.change(function () {
            if (channel.children?.length) {
                const checked = $(this).is(':checked');
                if (checked) {
                    selectedPlayAreaList = [
                        ...selectedPlayAreaList,
                        ...channel.children,
                    ];
                    selectedPlayAreaList = _.uniqBy(selectedPlayAreaList, 'id');
                } else {
                    selectedPlayAreaList = selectedPlayAreaList.filter(itemA => 
                        !channel.children.some(itemB => itemB.id === itemA.id)
                    );
                }
                updatePlayAreaSelectBtnStatus();
                createPlayareaChannelsDom();
            }
        });
        channelCheckbox.prop("indeterminate", false);
        channelCheckbox.prop("checked", false);
        if (channel.children?.length) {
            channelCheckbox.prop("disabled", false);
            if (selectedThingsInChannel.length) {
                if (selectedThingsInChannel.length === channel.children?.length) {
                    channelCheckbox.prop("indeterminate", false);
                    channelCheckbox.prop("checked", true);
                } else {
                    channelCheckbox.prop("indeterminate", true);
                    channelCheckbox.prop("checked", false);
                }
            }
        } else {
            channelCheckbox.prop("disabled", true);
        }
    });
}

//打开播放区域选择弹窗
function openPlayareaSelectModal (channel) {
    $playAreasModalTable.bootstrapTable('load', []);
    if (channel.children?.length) {
        playAreasModal.show();
        $playAreasModalTable.bootstrapTable('load', channel.children);
        //选中已选择的设备
        const selectedThingsInChannel = selectedPlayAreaList.filter(item1 => 
            channel.children?.some(item2 => item2.id === item1.id)
        );
        if (selectedThingsInChannel.length) {
            if (selectedThingsInChannel.length === channel.children?.length) {
                $playAreasModalTable.bootstrapTable('checkAll');
            } else {
                selectedThingsInChannel.forEach(thing => {
                    const index = channel.children.findIndex(item => item.id === thing.id);
                    $playAreasModalTable.bootstrapTable('check', index);
                });
            }
        } else {
            $playAreasModalTable.bootstrapTable('uncheckAll');
        }
    } else {
        showAlert('warning', `此分区没有设备`);
    }
}

//关闭播放区域选择弹窗
function closePlayareaSelectModal () {
    playAreasModal.hide();
    createPlayareaChannelsDom();
    updatePlayAreaSelectBtnStatus();
}

//更新播放区域全选、反选按钮的状态
function updatePlayAreaSelectBtnStatus () {
    const $btn = $('#play-area-select-unselect-all-btn');
    $btn.empty();
    if (selectedPlayAreaList.length) {
        $btn.attr('title', '清空选择');
        const $unselectIcon = $(`<i class="fa-solid fa-list"></i>`);
        $btn.append($unselectIcon);
    } else {
        $btn.attr('title', '全选');
        const $selectIcon = $(`<i class="fa-solid fa-list-check"></i>`);
        $btn.append($selectIcon);
    }
    createPlayareaChannelsDom();
}

// 通道名称-播放弹框
function channelNameTableFormatter (value, row, index) {
    let imageSrc = '/images/icon_channel_offline.png';
    if (row.metadata.is_online === "1") {
        imageSrc = '/images/icon_channel.png';
    }
    return `<div>
                <img loading="lazy" src="${imageSrc}" style="width: 16px; margin-bottom: 3px;" />
                <span>${row.metadata.aliase}</span>
            </div>`;
}

//生成场景下拉框
function createSceneSelectOptions () {
    $('#sceneSelect').empty();
    for (let i = 1; i <= 6; i++) {
        const $option = $(`<option value="${i}">场景 ${i}</option>`);
        $('#sceneSelect').append($option);
    }
    $('#sceneSelect').val(1);
    getSceneData(1); //获取场景1的数据
}

//生成调音设备下拉框
function createThingsSelectOptions () {
    $('#thingsSelect').empty();
    fetch(`/ui/things/thingsInJSON?page=1&limit=1000&onlineStatus=2&showFullData=false`, {
        method: "GET",
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); // 直接将流转换为JSON对象
        })
        .then(json => {
            const data = json.data;
            const thingsData = JSON.parse(data).thingsData;
            const onlineThingsList = thingsData && typeof thingsData === 'object' && 
                thingsData.things && typeof thingsData.things === 'object' ?  
                    thingsData.things.filter((thing)=>{
                        //identity 中有下划线则表示为多通道，默认在设备页面隐藏
                        return thing.credentials.identity && !thing.credentials.identity.includes("_");
                    }) || [] : [];
            onlineThingsList.forEach(thing => {
                $option = $(`<option value="${thing.id}">${thing.name}</option>`);
                $('#thingsSelect').append($option);
            });
            createSceneSelectOptions();
        });
}

// 页面初始化
function initPage () {
    if (domainID) {
        fetch(`/ui/domains/${domainID}/domainInJSON`, {
            method: "GET",
        })
            .then(response => {
                if (!response.ok) {
                throw new Error('Network response was not ok');
                }
                return response.json(); // 直接将流转换为JSON对象
            })
            .then(json => {
                const data = json.data;
                const domainData = JSON.parse(data).domainData;
                comID = domainData.metadata["comID"];
                getPlayAreaTree();
            });
    } else {
        redirectToLogin();
    }
}

//生成播放列表dom
function createPlaylistDom () {
    $('#playlist-container').empty();
    $('#playlist-delete-all-btn').prop('disabled', true);
    if (curPlaylist.length) {
        curPlaylist.forEach((item, index) => {
            const $item = (`
                <li 
                    class="list-group-item" 
                    style="
                        display: flex; 
                        justify-content: space-between;
                        background: whitesmoke;
                    "
                    id="playlist-item-${index}-container"
                >
                    <div style="line-height: 38px; width: 100%; display: flex;">
                        <img 
                            loading="lazy" 
                            src="/images/icon_mp3.png" 
                            style="
                                width: 20px;
                                height: 20px;
                                margin-top: 8px;
                                margin-right: 5px;
                            "
                        />
                        <div 
                            class="text-truncate" 
                            style="width: 240px;"
                            title="${item.fileName}"
                            id="playlist-item-${index}-label" 
                        >
                            ${item.fileName}
                        </div>
                    </div>
                    <button 
                        id="playlist-item-${index}-delete-btn" 
                        type="button" 
                        class="btn btn-light" 
                        title="删除"
                        style="display: none; color: orangered;"
                        onclick="deletePlaylistItem(${index})"
                    >
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </li>
            `);
            $('#playlist-container').append($item);
            $(`#playlist-item-${index}-container`).mouseenter(() => {
                $(`#playlist-item-${index}-delete-btn`).show();
                $(`#playlist-item-${index}-label`).css('width', '200px');
            });
            $(`#playlist-item-${index}-container`).mouseleave(() => {
                $(`#playlist-item-${index}-delete-btn`).hide();
                $(`#playlist-item-${index}-label`).css('width', '240px');
            });
        });
        $('#playlist-delete-all-btn').prop('disabled', false);
    }
}

//删除播放列表项
function deletePlaylistItem (index) {
    curPlaylist.splice(index, 1);
    createPlaylistDom();
}

//删除播放列表中的所有项
function deleteAllPlaylistItems () {
    curPlaylist = [];
    createPlaylistDom();
}

// 初始化加载文件列表-文件弹框
function loadFilesTable(folder) {
    $filesModalTable.bootstrapTable('load', []);
    if (!folder) {
        breadCrumbFolderList = [];
        breadCrumbFolderList.push({fileName: "文件列表", key: ""});
        currentFolderKey = "";
        generateBreadCrumb(breadCrumbFolderList);
    }
    const queryData = { path: folder, comID: comID };
    fetch(`${protocol}//${hostname}:${minioBridgePort}/resourceList`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response was not ok");
            }
            return response.json(); // 直接将流转换为JSON对象
        }).then(data => {
            $filesModalTable.bootstrapTable('load', data || []);
        }).catch(error => {
            console.error('Error:', error);
        });
}

// 禁用文件夹勾选框-文件弹框
function fileNameTableStateFormatter(value, row, index) {
    if (row.isDir) {
        return { disabled: true };
    }
    return value;
}

// 文件名称-文件弹框
function fileNameTableFormatter(value, row, index) {
    if (row.isDir) {
        return `<div style="cursor: pointer" data-key="${row.key}" data-filename="${row.fileName}" onclick="onClickFolder(event)">
                    <img loading="lazy" src="/images/icon_folder.png" style="width: 16px; margin-bottom: 3px;" />
                    <span>${value}</span>
                </div>`;
    } else {
        return `<div>
                    <img loading="lazy" src="/images/icon_mp3.png" style="width: 16px; margin-bottom: 3px;" />
                    <span>${value}</span>
                </div>`;
    }
}

//生成面包屑导航-文件弹框
function generateBreadCrumb(folderList) {
    //监听breadCrumbFolderList变化，更新面包屑导航
    const breadcrumbNavigator = $("#breadcrumbNavigator");
    breadcrumbNavigator.empty();
    folderList.forEach((folder, index) => {
        let activeClass = "";
        if (index === folderList.length - 1) {
            activeClass = "active";
        }
        const li = $(`
            <li 
                class="breadcrumb-item ${activeClass}" 
                data-key="${folder.key}" 
                data-filename="${folder.fileName}" 
                onclick="onClickBreadcrumbItem(event)"
            >
                ${folder.fileName}
            </li>
        `);
        breadcrumbNavigator.append(li);
    });
}

//点击breadCrumb-文件弹框
function onClickBreadcrumbItem(e) {
    const key = e.currentTarget.dataset.key;
    currentFolderKey = key;
    //删除后面的所有文件夹
    const rowIndex = breadCrumbFolderList.findIndex(item => item.key === key);
    breadCrumbFolderList.splice(rowIndex + 1, breadCrumbFolderList.length - rowIndex);

    generateBreadCrumb(breadCrumbFolderList);
    loadFilesTable(key);
}

//点击文件夹-文件弹框
function onClickFolder(e) {
    // Use event.currentTarget to get the element that the event listener is attached to
    // event.currentTarget：指向事件监听器所附加的元素，即 <div> 元素。
    // event.target：指向触发事件的实际元素，即 <span> 或 <img> 元素。
    const key = e.currentTarget.dataset.key;
    const fileName = e.currentTarget.dataset.filename;
    currentFolderKey = key;
    breadCrumbFolderList.push({fileName: fileName, key: key});
    generateBreadCrumb(breadCrumbFolderList);
    loadFilesTable(key);
}