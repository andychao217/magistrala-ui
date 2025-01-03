let currentDevices = {}, 
    newDevices = {},
    scanNewThingsList = [],
    selectedNewThingNames = [],
    allThingsList = [],
    curDevice = {}, //当前设备
    $network_speech_area_tree = null, // 网络扩声区域树
    network_speech_area_treeData = [], // 播放区域树数据
    selected_network_speech_areas = []; //设备设置-选中的网络扩声区域;
const deviceNetCfgModal = new bootstrap.Modal(document.getElementById("deviceNetCfgModal")), // 设备网络配置弹框
        editThingModal = new bootstrap.Modal(document.getElementById("editThingModal")), // 设备设置弹框
        moreEditThingModal= new bootstrap.Modal(document.getElementById("moreEditThingModal")), // 设备高级设置弹框
        networkSpeechAreasAddModal = new bootstrap.Modal(document.getElementById("networkSpeechAreasAddModal")), // 新增广播区域弹框
        networkSpeechAreasDetailModal = new bootstrap.Modal(document.getElementById("networkSpeechAreasDetailModal")), // 广播区域详情弹框
        scanThingsModal = new bootstrap.Modal(document.getElementById("scanThingsModal")), // 扫描设备弹框
        addRadioFreqModal = new bootstrap.Modal(document.getElementById("addRadioFreqModal")), // 添加收音机频率弹框
        $powerCfgTable = $('#powerCfgTable');
        requiredMsg = '不能为空',
        radioFreqListErrorMsg = '只能输入正整数或者一位小数',
        url = window.location.href, // 获取当前页面的URL
        onlineStatusValue = (url.match(/onlineStatus=(\d+)/) || [])[1] || 
        sessionStorage.getItem("onlineStatus") || '1'; // 从URL获取onlineStatus的值

$(document).ready(function() {
    sessionStorage.setItem("onlineStatus", onlineStatusValue);
    getThingsList(onlineStatusValue, false);
    getAllThingsList();

    // 根据路径参数配置设备状态选中标签
    if (onlineStatusValue === '1') {
        $('#btnAll').prop('checked', false);
        $('#btnOnline').prop('checked', true);
        $('#btnOffline').prop('checked', false);
    } else if (onlineStatusValue === '0') {
        $('#btnAll').prop('checked', false);
        $('#btnOnline').prop('checked', false);
        $('#btnOffline').prop('checked', true);
    } else {
        $('#btnAll').prop('checked', true);
        $('#btnOnline').prop('checked', false);
        $('#btnOffline').prop('checked', false);
    }

    // 切换要查看的设备状态
    $('input[name="btnOnlineStatus"]').change(function() {
        let reqOnlineStatus = '2'; //all
        if (this.id === 'btnOnline') {
            reqOnlineStatus = '1'; //online
        } else if (this.id === 'btnOffline') {
            reqOnlineStatus = '0'; //offline
        }
        sessionStorage.setItem("onlineStatus", reqOnlineStatus);
        window.location.href = `/ui/things?limit=1000&onlineStatus=${reqOnlineStatus}&showFullData=true`;
        stopPollingThings();
        getThingsList(reqOnlineStatus);
    });

    //搜索添加设备确认添加按钮事件
    $('#scan-add-thing-button').on('click', () => {
        const callback = () => {
            addScanNewThings();
        };
        getAllThingsList(callback)
    });

    //搜索添加设备-网络配置-手动、自动下拉选项
    $('#dhcp_enable-deviceNetCfg').change(function() {
        const deviceName = $(this).attr('data-device_name');
        const deviceInfo = scanNewThingsList.find((item)=>item.device_name === deviceName); 
        const dhcp_enable = $(this).val();
        let ip = deviceInfo.netcfg.static_ip, 
            gateway = deviceInfo.netcfg.static_gateway,
            netmask = deviceInfo.netcfg.static_netmask, 
            dns1 = deviceInfo.netcfg.static_dns1, 
            dns2 = deviceInfo.netcfg.static_dns2,
            disabled = false;
            if (dhcp_enable === "1") {
                //自动
                ip = deviceInfo.netcfg.dhcp_ip;
                gateway = deviceInfo.netcfg.dhcp_gateway;
                netmask = deviceInfo.netcfg.dhcp_netmask;
                dns1 = deviceInfo.netcfg.dhcp_dns1;
                dns2 = deviceInfo.netcfg.dhcp_dns2;
                disabled = true;

                $('#ipError').empty();
                $('#gatewayError').empty();
                $('#netmaskError').empty();
                $('#dns1Error').empty();
                $('#dns2Error').empty();
            }

            $('#ip-deviceNetCfg').val(ip);
            $('#gateway-deviceNetCfg').val(gateway);
            $('#netmask-deviceNetCfg').val(netmask);
            $('#dns1-deviceNetCfg').val(dns1);
            $('#dns2-deviceNetCfg').val(dns2);

            $('#ip-deviceNetCfg').prop('disabled', disabled);
            $('#gateway-deviceNetCfg').prop('disabled', disabled);
            $('#netmask-deviceNetCfg').prop('disabled', disabled);
            $('#dns1-deviceNetCfg').prop('disabled', disabled);
            $('#dns2-deviceNetCfg').prop('disabled', disabled);

            scanNewThingsList = scanNewThingsList.map((item)=>{
            if(item.device_name === deviceName) {
                item.netcfg.dhcp_enable = dhcp_enable === "1";
            }
            return item;
        });
    });

    //搜索添加设备-网络配置-手动-注册所有输入框的验证和保存逻辑
    const netConfigArray = ['alias', 'ip', 'gateway', 'netmask', 'dns1', 'dns2'];
    netConfigArray.forEach((config) => {
        validateAndSave(config, "");
    });

    //搜索添加设备-网络配置-确认按钮
    $('#deviceNetCfgModal-confirm-button').on('click', function() {
        const deviceName = $(this).attr('data-device_name');
        const deviceInfo = scanNewThingsList.find(item => item.device_name === deviceName);
        const dhcp_enable = deviceInfo.netcfg.dhcp_enable;
        let canCloseModal = true;

        function validateAndUpdateError(inputId) {
            const value =  $(`#${inputId}-deviceNetCfg`).val();
            if (inputId === 'alias') {
                if (!value) {
                    $(`#${inputId}Error`).html('请输入设备名称');
                    canCloseModal = false;
                } else {
                    $(`#${inputId}Error`).empty();
                }
            } else {
                if (!IPV4REGX.test(value)) {
                    $(`#${inputId}Error`).html(IPERRORMSG);
                    canCloseModal = false;
                } else {
                    $(`#${inputId}Error`).empty();
                }
            }
        }

        validateAndUpdateError('alias');

        if (!dhcp_enable) {
            validateAndUpdateError('ip');
            validateAndUpdateError('gateway');
            validateAndUpdateError('netmask');
            validateAndUpdateError('dns1');
            validateAndUpdateError('dns2');
        }

        if (canCloseModal) {
            if (!selectedNewThingNames.includes(deviceName)) {
                selectedNewThingNames.push(deviceName);
            }
            showNewThingsGrid(scanNewThingsList, selectedNewThingNames);
            scanThingsModal.show();
            deviceNetCfgModal.hide();
        }
    });

    //关闭弹框遮罩残余
    const scanThingsModalDiv = document.getElementById("scanThingsModal");
    scanThingsModalDiv.addEventListener('hidden.bs.modal', function (event) {
        $('.modal-backdrop.fade.show').remove();
    });

    // 点击更多设置按钮时，切换显示更多设置-设备设置弹框
    $('#moreSettingEditThingModal').click(function() {
        const callback = function() {
            const thingID = $('#moreEditThingModal').attr('data-device_id');
            const originalDevice = allThingsList.find(thing => thing.id === thingID);
            initMoreEditThingModal(originalDevice);
            editThingModal.hide();
            moreEditThingModal.show();
        }
        getAllThingsList(callback);
    });

    // 输入设备名称时，验证以及调整相关数据
    $('#deviceNameEditThingModal').on('change blur keyup', function(event) {
        const newDeviceName = $(this).val();
        if (newDeviceName) {
            $(`#deviceNameErrorEditThingModal`).empty();
            $('#deviceNameErrorEditThingModal').hide();
            const thingID = $("#editThingModal").attr('data-device_id');
            const originalDevice = allThingsList.find(thing => thing.id === thingID);
            const originalDeviceAliase = originalDevice.metadata["aliase"] || "";
            const originalDeviceName = originalDevice.name;
            if (originalDeviceName !== newDeviceName && event.type === 'blur') {
                let queryData = {...originalDevice.metadata.info};
                queryData.device_aliase = newDeviceName;
                const data = {
                    controlType:  "deviceAliaseSet", 
                    thingIdentity: originalDevice.credentials.identity, 
                    deviceInfo: queryData,
                };
                controlThing(data);
            }
        } else {
            $(`#deviceNameErrorEditThingModal`).html(requiredMsg);
            $('#deviceNameErrorEditThingModal').show();
        }
    });
});

// 启动轮询
function startPollingThings() {
    return setInterval(refreshThingsData, 2000); // 每5秒轮询一次
}

// 清理并重启轮询
function resetPollingThings(intervalId) {
    clearInterval(intervalId);
    return startPollingThings();
}

// 停止轮询
function stopPollingThings() {
    if (pollingIntervalIdThings) {
        clearInterval(pollingIntervalIdThings);
        pollingIntervalIdThings = null;
    }
}

// 初始启动轮询
let pollingIntervalIdThings = null;

// 每10分钟清理并重启轮询
let resetPollingThingsInterval = setInterval(function() {
    pollingIntervalIdThings = resetPollingThings(pollingIntervalIdThings);
}, 10 * 60 * 1000); // 10分钟

// 在组件卸载时停止调用
window.addEventListener('beforeunload', ()=>{
    stopPollingThings();
    clearInterval(resetPollingThingsInterval);
    resetPollingThingsInterval = null;
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        stopPollingThings();
    } else {
        pollingIntervalIdThings = startPollingThings();
    }
});

//打开弹框
function openModal(modal) {
    if (modal === "scan") {
        scanNewThings();
    }
}

//生成输入、输出通道配置项-修改设备弹框
function createChannelConfig (channel, channelType, thingIdentity) {
    const channelLabel = channelType === "in" ? "输入名称" : "输出名称";
    const controlType = channelType === "in" ? "deviceInChannelEdit" : "deviceOutChannelEdit";
    const $channelConfig = $(`
        <div class="mb-3 row">
            <label for="${channelType}_channel_aliase_${channel.id}" class="col-sm-3 col-form-label">
                ${channelLabel}
            </label>
            <div class="col-sm-9">
                <div>
                    <input 
                        type="text" 
                        class="form-control name-field" 
                        name="${channelType}_channel_aliase_${channel.id}" 
                        id="${channelType}_channel_aliase_${channel.id}"
                        placeholder="${channelLabel}" 
                        maxlength="20"
                        value="${channel.aliase}" 
                    />
                    <div id="${channelType}_channel_aliase_error_${channel.id}" class="text-danger inputError"></div>
                </div>
                <div style="display: flex; margin-top: 7px;">
                    <input 
                        type="range" 
                        class="form-conrtol rangeInput" 
                        min="0" 
                        max="15" 
                        step="1" 
                        value="${channel.volume}" 
                        id="${channelType}_channel_volume_${channel.id}"
                        style="width: 100%; margin-top: 8px;"
                    />
                    <div 
                        id="${channelType}_channel_volumeLabel_${channel.id}" 
                        style="text-align: right; width: 30px; line-height: 25px;"
                    >
                        ${channel.volume}
                    </div>
                </div>
            </div>
        </div>
    `);
    $(`#${channelType}_channels_container_EditThingModal`).append($channelConfig);

    $(`#${channelType}_channel_aliase_${channel.id}`).on('change blur keyup', function(event) {
        const channel_aliase = $(this).val();
        if (channel_aliase) {
            $(`#${channelType}_channel_aliase_error_${channel.id}`).empty();
            $(`#${channelType}_channel_aliase_error_${channel.id}`).hide();
            const queryData = _.cloneDeep(channel);
            queryData.aliase = channel_aliase;
            if (event.type === 'blur') {
                const data = {
                    controlType:  controlType, 
                    thingIdentity: thingIdentity,
                    channelAttr: queryData,
                }
                controlThing(data);
            }
            
        } else {
            $(`#${channelType}_channel_aliase_error_${channel.id}`).html(requiredMsg);
            $(`#${channelType}_channel_aliase_error_${channel.id}`).show();
        }
    });

    $(`#${channelType}_channel_volume_${channel.id}`).on('input change', function(event) {
        const channel_volume = $(event.currentTarget).val();
        $(`#${channelType}_channel_volumeLabel_${channel.id}`).html(channel_volume);
        if (event.type === 'change') {
            const queryData = _.cloneDeep(channel);
            queryData.volume = Number(channel_volume);
            const data = {
                controlType:  controlType, 
                thingIdentity: thingIdentity,
                channelAttr: queryData,
            }
            controlThing(data);
        }
    });

    //设置rangeInput的value值时，改变其背景色
    const rangeInputs = document.querySelectorAll('.rangeInput');
    rangeInputs.forEach(rangeInput => {
        rangeInput.addEventListener('input', () => updateRangeBackground(rangeInput));
        updateRangeBackground(rangeInput); // 初始化背景
    });
}

//修改设备
function editThing(id) {
    const callback = function () {
        const originalDevice = allThingsList.find(thing => thing.id === id);
        $("#editThingModal").attr("data-device_id", id);
        $('#moreEditThingModal').attr("data-device_id", id);
        $("#deviceNameEditThingModal").val(originalDevice.name);
        $('#out_channels_container_EditThingModal').empty();
        if (
            originalDevice.metadata && 
            originalDevice.metadata["info"] && 
            originalDevice.metadata["info"].out_channel &&
            originalDevice.metadata["info"].out_channel.channel && 
            originalDevice.metadata["info"].out_channel.channel.length
        ) {
            originalDevice.metadata["info"].out_channel.channel.forEach((channel)=>{
                createChannelConfig(channel, 'out', originalDevice.credentials.identity);
            });
        }
        editThingModal.show();
    }
    getAllThingsList(callback);
}

//修改设备弹框-网络配置-切换手动、自动
function handleChangeDHCPEnable(radio) {
    const deviceID = $(radio).attr("data-device_id");
    const device = allThingsList.find(thing => thing.id === deviceID);
    const deviceInfo = _.cloneDeep(device.metadata?.info);
    const dhcp_enable = Number(radio.value) === 1 ? true : false;
    let ip = deviceInfo.netcfg.static_ip, 
            gateway = deviceInfo.netcfg.static_gateway,
            netmask = deviceInfo.netcfg.static_netmask, 
            dns1 = deviceInfo.netcfg.static_dns1, 
            dns2 = deviceInfo.netcfg.static_dns2,
            disabled = false;
    if (dhcp_enable) {
        //自动
        ip = deviceInfo.netcfg.dhcp_ip;
        gateway = deviceInfo.netcfg.dhcp_gateway;
        netmask = deviceInfo.netcfg.dhcp_netmask;
        dns1 = deviceInfo.netcfg.dhcp_dns1;
        dns2 = deviceInfo.netcfg.dhcp_dns2;
        disabled = true;

        $('#ipError-moreEditThingModal').empty();
        $('#gatewayError-moreEditThingModal').empty();
        $('#netmaskError-moreEditThingModal').empty();
        $('#dns1Error-moreEditThingModal').empty();
        $('#dns2Error-moreEditThingModal').empty();
    }

    $('#ip-deviceNetCfg-moreEditThingModal').val(ip);
    $('#gateway-deviceNetCfg-moreEditThingModal').val(gateway);
    $('#netmask-deviceNetCfg-moreEditThingModal').val(netmask);
    $('#dns1-deviceNetCfg-moreEditThingModal').val(dns1);
    $('#dns2-deviceNetCfg-moreEditThingModal').val(dns2);

    $('#ip-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
    $('#gateway-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
    $('#netmask-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
    $('#dns1-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
    $('#dns2-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
}

// 获取组装扩声区域设备树-扩声区域弹框
function getNetworkSpeechAreaTree() {
    network_speech_area_treeData = [{
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
                                children: channel.metadata && channel.metadata.thing_ids && channel.metadata.thing_ids.length ? 
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
                                        }
                                    } else {
                                        return {}
                                    }
                                }).filter((thing)=>thing.id) : [],
                            };
                            network_speech_area_treeData[0].children.push(channelNode);
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
                            };
                            network_speech_area_treeData[0].children[0].children.push(thingNode);
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
                            };
                            network_speech_area_treeData[0].children[0].children.push(thingNode);
                        });
                    }
                    $network_speech_area_tree = $('#network_speech_area_tree').tree({
                        primaryKey: 'key',
                        uiLibrary: 'bootstrap5',
                        dataSource: network_speech_area_treeData,
                        checkboxes: true,
                        imageUrlField: 'flagUrl',
                        icons: {
                            expand: '<i class="fa-solid fa-angle-down"></i>',
                            collapse: '<i class="fa-solid fa-angle-up"></i>'
                        }
                    });
                });
        })
        .catch(error => {});
}

// 生成网络扩声-扩声区域
function createNetworkSpeechAreaList(){
    $('#network_speech_area_list_container').empty();
    if (selected_network_speech_areas.length) {
        const limit = selected_network_speech_areas.length >= 4 ? 4 : selected_network_speech_areas.length;
        for (let i = 0; i < limit; i++) {
            const $network_speech_area = $(`
                <div class="d-grid col-6" title="${selected_network_speech_areas[i].metadata.aliase}">
                    <button disabled type="button" class="btn btn-light truncate-text" style="color: #20afbf;">
                        <img loading="lazy" src="/images/icon_channel.png" class="channel-icon" />
                        <span>${selected_network_speech_areas[i].metadata.aliase}</span>
                    </button>
                </div>
            `);
            $('#network_speech_area_list_container').append($network_speech_area);
        }
    }
}

// 关闭添加播放区域弹框-添加播放区域弹框
function closeNetworkSpeechAreasAddModal() {
    networkSpeechAreasAddModal.hide();
    moreEditThingModal.show();
    if (selected_network_speech_areas && selected_network_speech_areas.length) {
        $('#localSpeech-network_speech_area_Error').hide();
        $('#localSpeech-network_speech_area_Error').empty();
        createNetworkSpeechAreaList();
    } else {
        $('#localSpeech-network_speech_area_Error').html(requiredMsg);
        $('#localSpeech-network_speech_area_Error').show();
    }
}

// 生成播放区域详情列表-播放区域详情弹框
function createNetworkSpeechAreasAreasDetailList() {
    $('#network_speech_areas_detail_list_container').empty();
    if (selected_network_speech_areas.length) {
        const limit = selected_network_speech_areas.length;
        for (let i = 0; i < limit; i++) {
            const $network_speech_areas_detail_item = $(`
                <div class="d-grid col-4" title="${selected_network_speech_areas[i].metadata.aliase}">
                    <div class="hoverCard card" style="height:95px;">
                        <div class="card-body" style="text-align: center;">
                            <img loading="lazy" src="/images/icon_channel.png" style="margin-bottom: 5px; width: 32px;" />
                            <div class="truncate-text" style="font-size: 14px; width: 100%;">
                                ${selected_network_speech_areas[i].metadata.aliase}
                            </div>
                        </div>
                    </div>
                </div>
            `);
            $('#network_speech_areas_detail_list_container').append($network_speech_areas_detail_item);
        }
    }
}

// 验证收音机频率
function validateRadioFreq(value) {
    const regex = /^(0\.[1-9]|[1-9]\d*(\.\d)?)$/;
    return regex.test(value)
}

// 生成收音机列表
function createRadioFreqList(radioFreqList) {
    const $radioFreqListContainer = $('#moreEditThingModal-radioFreq-container');
    $radioFreqListContainer.empty();
    const $addRadioFreqButton = $(`
        <div
            class="hoverCard card deviceOperation-btn addBtn"
            id="moreEditThingModal-radioFreq-addBtn"
        >
            <div class="card-body deviceOperation-btn-container">
                <div class="deviceOperation-btn-icon">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <div class="row">
                    新增
                </div>
            </div>
        </div>
    `);

    if (radioFreqList && radioFreqList.length) {
        radioFreqList.forEach((radioFreq, index) => {
            const $radioFreqItem = $(`
                <div
                    class="
                        hoverCard 
                        card 
                        deviceOperation-btn 
                        ${radioFreq.used ? 'primaryBtn' : 'disabledBtn'}
                    "
                    id="moreEditThingModal-radioFreq-${index}"
                >
                    <div class="card-body deviceOperation-btn-container">
                        <div 
                            class="deviceOperation-btn-icon" 
                            id="moreEditThingModal-radioFreq-${index}-iconContainer"
                        >
                            <i class="fa-solid fa-radio"></i>
                        </div>
                        <div class="row" style="margin-top: -15px; margin-bottom: 10px;">
                            ${radioFreq.name}
                        </div>
                        <div 
                            class="row" 
                            style="cursor: pointer"
                            id="moreEditThingModal-radioFreq-${index}-toggleBtn"
                        >
                            ${radioFreq.used ? '启用' : '未启用'}
                        </div>
                    </div>
                </div>
            `);
            $radioFreqListContainer.append($radioFreqItem);
            //鼠标移入收音机按钮切换为删除按钮
            $(`#moreEditThingModal-radioFreq-${index}`).mouseenter(function() {
                $(this).removeClass("primaryBtn disabledBtn").addClass("dangerBtn");
                $(`#moreEditThingModal-radioFreq-${index}-iconContainer`).empty();
                const $trashIcon = $(`
                    <span id="moreEditThingModal-radioFreq-${index}-deleteBtn">
                        <i class="fa-solid fa-trash-can"></i>
                    </span>
                `);
                $(`#moreEditThingModal-radioFreq-${index}-iconContainer`).append($trashIcon);
                //点击删除按钮
                $(`#moreEditThingModal-radioFreq-${index}-deleteBtn`).click(function() {
                    const data = {
                        controlType:  "deviceRadioFreqDelete", 
                        thingIdentity: curDevice.credentials.identity, 
                        radioFreq,
                    }
                    controlThing(data, controlThing({controlType: 'deviceRadioFreqGet'}));
                });
            });

            //鼠标移出收音机按钮切换为正常按钮
            $(`#moreEditThingModal-radioFreq-${index}`).mouseleave(function() {
                const addClass = radioFreq.used ? 'primaryBtn' : 'disabledBtn';
                $(this).removeClass("dangerBtn").addClass(addClass);
                $(`#moreEditThingModal-radioFreq-${index}-iconContainer`).empty();
                const $radioIcon = $(`<i class="fa-solid fa-radio"></i>`);
                $(`#moreEditThingModal-radioFreq-${index}-iconContainer`).append($radioIcon);
            });

            //点击收音机按钮切换状态
            $(`#moreEditThingModal-radioFreq-${index}-toggleBtn`).click(function() {
                const data = {
                    controlType:  "deviceSpeechCfgSet", 
                    thingIdentity: curDevice.credentials.identity, 
                    radioFreq: {
                        ...radioFreq,
                        used: !radioFreq.used,
                    },
                };
                controlThing(data, controlThing({controlType: 'deviceRadioFreqGet'}));
            });
        })
    }
    $radioFreqListContainer.append($addRadioFreqButton);
    //点击新增收音机按钮
    $(`#moreEditThingModal-radioFreq-addBtn`).click(function() {
        moreEditThingModal.hide();
        addRadioFreqModal.show();
        $('#name-addRadioFreqModal').val('');
        $('#freq-addRadioFreqModal').val('');
    });

    // 验证频率名称
    $('#name-addRadioFreqModal').on('input change blur', function() {
        const name = $(this).val();
        if (name) {
            $(`#name-error-addRadioFreqModal`).empty();
            $('#name-error-addRadioFreqModal').hide();
        } else {
            $(`#name-error-addRadioFreqModal`).html(requiredMsg);
            $('#name-error-addRadioFreqModal').show();
        }
    });

    // 验证频率值
    $('#freq-addRadioFreqModal').on('input change blur', function() {
        const freq = $(this).val();
        if (freq) {
            if (validateRadioFreq(freq)) {
                $(`#freq-error-addRadioFreqModal`).empty();
                $('#freq-error-addRadioFreqModal').hide();
            } else {
                $(`#freq-error-addRadioFreqModal`).html(radioFreqListErrorMsg);
                $('#freq-error-addRadioFreqModal').show();
            }
        } else {
            $(`#freq-error-addRadioFreqModal`).html(requiredMsg);
            $('#freq-error-addRadioFreqModal').show();
        }
    });

    $('#confirm-btn-addRadioFreqModal').click(function() {
        const name = $('#name-addRadioFreqModal').val();
        const freq = $('#freq-addRadioFreqModal').val();
        let canSave = true;

        if (!name) {
            canSave = false;
            $(`#name-error-addRadioFreqModal`).html(requiredMsg);
            $('#name-error-addRadioFreqModal').show();
        } else {
            canSave = true;
            $(`#name-error-addRadioFreqModal`).empty();
            $('#name-error-addRadioFreqModal').hide();
        }
        if (!freq) {
            canSave = false;
            $(`#freq-error-addRadioFreqModal`).html(requiredMsg);
            $('#freq-error-addRadioFreqModal').show();
        } else {
            if (validateRadioFreq(freq)) {
                canSave = true;
                $(`#freq-error-addRadioFreqModal`).empty();
                $('#freq-error-addRadioFreqModal').hide();
            } else {
                canSave = false;
                $(`#freq-error-addRadioFreqModal`).html(radioFreqListErrorMsg);
                $('#freq-error-addRadioFreqModal').show();
            }
        }

        if (canSave) {
            const callback = () => {
                addRadioFreqModal.hide();
                moreEditThingModal.show();
                controlThing({controlType: 'deviceRadioFreqGet'})
            };
            const data = {
                controlType:  "deviceSpeechCfgAdd", 
                thingIdentity: curDevice.credentials.identity, 
                radioFreq: {
                    name,
                    freq: Number(freq),
                    used: false,
                },
            };
            controlThing(data, callback);
        }
    });
}

//初始化更多设置
function initMoreEditThingModal(device) {
    curDevice = _.cloneDeep(device);
    $("#deviceNameTitleMoreEditThingModal").html(device.name || "");
    //显示第一个tab标签
    const triggerEl = document.querySelector('#v-pills-tab button[data-bs-toggle="pill"]')
    bootstrap.Tab.getInstance(triggerEl).show();

    $(".moreEditThingModal-sysInfo-content").empty();
    $('#in_channels_container_EditThingModal').empty();

    const deviceInfo = _.cloneDeep(device.metadata?.info);
    if (deviceInfo && !_.isEmpty(deviceInfo)) {
        //网络设置
        let ip = deviceInfo.netcfg?.static_ip, 
            gateway = deviceInfo.netcfg?.static_gateway,
            netmask = deviceInfo.netcfg?.static_netmask, 
            dns1 = deviceInfo.netcfg?.static_dns1, 
            dns2 = deviceInfo.netcfg?.static_dns2;
            dhcp_enable = deviceInfo.netcfg?.dhcp_enable,
            disabled = false,
            deviceID = device.id;
        if (dhcp_enable) {
            ip = deviceInfo.netcfg?.dhcp_ip;
            gateway = deviceInfo.netcfg?.dhcp_gateway;
            netmask = deviceInfo.netcfg?.dhcp_netmask;
            dns1 = deviceInfo.netcfg?.dhcp_dns1;
            dns2 = deviceInfo.netcfg?.dhcp_dns2;
            disabled = true;
            document.getElementById("dhcp_enable-deviceNetCfg-moreEditThingModal-manual").checked = false;
            document.getElementById("dhcp_enable-deviceNetCfg-moreEditThingModal-auto").checked = true;
        } else {
            document.getElementById("dhcp_enable-deviceNetCfg-moreEditThingModal-manual").checked = true;
            document.getElementById("dhcp_enable-deviceNetCfg-moreEditThingModal-auto").checked = false;
        }

        $('#ipError-moreEditThingModal').empty();
        $('#gatewayError-moreEditThingModal').empty();
        $('#netmaskError-moreEditThingModal').empty();
        $('#dns1Error-moreEditThingModal').empty();
        $('#dns2Error-moreEditThingModal').empty();
        
        $('#ip-deviceNetCfg-moreEditThingModal').attr('data-device_id', deviceID);
        $('#gateway-deviceNetCfg-moreEditThingModal').attr('data-device_id', deviceID);
        $('#netmask-deviceNetCfg-moreEditThingModal').attr('data-device_id', deviceID);
        $('#dns1-deviceNetCfg-moreEditThingModal').attr('data-device_id', deviceID);
        $('#dns2-deviceNetCfg-moreEditThingModal').attr('data-device_id', deviceID);
        $('#dhcp_enable-deviceNetCfg-moreEditThingModal-manual').attr('data-device_id', deviceID);
        $('#dhcp_enable-deviceNetCfg-moreEditThingModal-auto').attr('data-device_id', deviceID);
        $('#deviceNetCfgModal-confirm-button-moreEditThingModal').attr('data-device_id', deviceID);

        $('#ip-deviceNetCfg-moreEditThingModal').val(ip);
        $('#gateway-deviceNetCfg-moreEditThingModal').val(gateway);
        $('#netmask-deviceNetCfg-moreEditThingModal').val(netmask);
        $('#dns1-deviceNetCfg-moreEditThingModal').val(dns1);
        $('#dns2-deviceNetCfg-moreEditThingModal').val(dns2);

        $('#ip-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
        $('#gateway-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
        $('#netmask-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
        $('#dns1-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);
        $('#dns2-deviceNetCfg-moreEditThingModal').prop('disabled', disabled);

        const netConfigArray = ['ip', 'gateway', 'netmask', 'dns1', 'dns2'];
        netConfigArray.forEach((config) => {
            validateAndSave(config, '-moreEditThingModal');
        });

        //设备网络配置修改-保存按钮
        $('#deviceNetCfgModal-confirm-button-moreEditThingModal').on('click', function() {
            const deviceID = $(this).attr('data-device_id');
            const device = allThingsList.find(thing => thing.id === deviceID);
            const deviceInfo = _.cloneDeep(device.metadata?.info);
            const dhcp_enable = document.getElementById("dhcp_enable-deviceNetCfg-moreEditThingModal-auto").checked;
            let canSave = true;

            function validateAndUpdateError(inputId) {
                const value =  $(`#${inputId}-deviceNetCfg-moreEditThingModal`).val();
                if (!IPV4REGX.test(value)) {
                    $(`#${inputId}Error-moreEditThingModal`).html(IPERRORMSG);
                    canSave = false;
                } else {
                    $(`#${inputId}Error-moreEditThingModal`).empty();
                }
            }

            if (!dhcp_enable) {
                validateAndUpdateError('ip');
                validateAndUpdateError('gateway');
                validateAndUpdateError('netmask');
                validateAndUpdateError('dns1');
                validateAndUpdateError('dns2');
            }

            if (canSave) {
                deviceInfo.netcfg.dhcp_enable = dhcp_enable;
                if (!dhcp_enable) {
                    deviceInfo.netcfg.static_ip = $(`#ip-deviceNetCfg-moreEditThingModal`).val();
                    deviceInfo.netcfg.static_gateway = $(`#gateway-deviceNetCfg-moreEditThingModal`).val();
                    deviceInfo.netcfg.static_netmask = $(`#netmask-deviceNetCfg-moreEditThingModal`).val();
                    deviceInfo.netcfg.static_dns1 = $(`#dns1-deviceNetCfg-moreEditThingModal`).val();
                    deviceInfo.netcfg.static_dns2 = $(`#dns2-deviceNetCfg-moreEditThingModal`).val();
                }
                const cancelCallback = function () {
                    moreEditThingModal.show();
                };
                moreEditThingModal.hide();
                showConfirmModal("修改设备网络配置，设备会自动重启，确定要进行此操作吗，是否继续？", () => {
                    const callback = function () {
                        moreEditThingModal.hide();
                        editThingModal.hide();
                    }
                    const data = {
                        controlType:  "deviceInfoSet", 
                        thingIdentity: device.credentials.identity, 
                        deviceInfo: deviceInfo,
                    }
                    controlThing(data, callback);
                }, cancelCallback);
            }
        });

        //输入通道
        if (
            deviceInfo.in_channel && 
            deviceInfo.in_channel?.channel && 
            deviceInfo.in_channel?.channel?.length
        ) {
            $('#moreEditThingModal-inChannels-tab').show();
            deviceInfo.in_channel?.channel?.filter((channel) => !channel.ignore).forEach((channel)=>{
                createChannelConfig(channel, 'in', device.credentials?.identity);
            });
        } else {
            $('#moreEditThingModal-inChannels-tab').hide();
        }

        //显示设备信息
        $("#moreEditThingModal-sysInfo-firmware").html(deviceInfo.sw_version || "");
        $("#moreEditThingModal-sysInfo-manufacturer").html(deviceInfo.manufacturer || "");
        $("#moreEditThingModal-sysInfo-productName").html(deviceInfo.product_name || "");
        $("#moreEditThingModal-sysInfo-productSN").html(deviceInfo.product_serial || "");
        $("#moreEditThingModal-sysInfo-amplifierType").html(deviceInfo.pa_type || "");
        const total_capacity = deviceInfo.total_capacity || 0;
        const total_capacityStr = (total_capacity / 1024).toFixed(2) + "GB";
        const available_capacity = deviceInfo.available_capacity || 0;
        const available_capacityStr = (available_capacity / 1024).toFixed(2) + "GB";
        $("#moreEditThingModal-sysInfo-totalVolumn").html(total_capacityStr);
        $("#moreEditThingModal-sysInfo-availableVolumn").html(available_capacityStr);
        $("#moreEditThingModal-sysInfo-wifiMAC").html(deviceInfo.wifi_mac_addr || "");
        $("#moreEditThingModal-sysInfo-lanMAC").html(deviceInfo.eth_mac_addr || "");

        $('#moreEditThingModal-localSpeech-tab').hide();
        $('#moreEditThingModal-bluetooth-tab').hide();
        $('#moreEditThingModal-otherOperation-tab').hide();
        $('#moreEditThingModal-powerCfg-tab').hide();
        $('#moreEditThingModal-audioMatrix-tab').hide();
        $('#moreEditThingModal-radio-tab').hide();
        $('#moreEditThingModal-u-channel-tab').hide();
        $('#moreEditThingModal-speaker-volume-tab').hide();
        $('#moreEditThingModal-eqCfg-tab').hide();

        //NXT3602的6组扬声器音量、话筒EQ
        if (deviceInfo.product_name.includes("3602") || deviceInfo.product_name.includes("3603") || deviceInfo.product_name.includes("9823")) {
            //音量设置
            const volume_trans_array = [-90, -30, -25, -22, -19, -16, -13, -10, -8, -6, -5, -4, -3, -2, -1, 0];
            $('#moreEditThingModal-speaker-volume-tab').show();
            for(let i = 1; i <= 6; i++) {
                $(`#speaker-volume-range-wrapper-${i}`).mouseenter(() => {
                    $('#moreEditThingModal-speaker-volume-pic').attr('src', `/images/volume_${i}.png`);
                });
                $(`#speaker-volume-range-wrapper-${i}`).mouseleave(() => {
                    $('#moreEditThingModal-speaker-volume-pic').attr('src', '/images/volume_0.png');
                });

                const initialValue = volume_trans_array.findIndex((value) => value === (deviceInfo.misc_cfg?.speaker_volume[`volume${i}`] || -90));
                $(`#speaker-volume-${i}`).val(initialValue);
                $(`#speaker-volume-indicator-${i}`).html(initialValue);
                $(`#speaker-volume-${i}`).on('input change', (event) => {
                    const value = $(event.currentTarget).val(),
                            volume1 = volume_trans_array[Number($(`#speaker-volume-1`).val())],
                            volume2 = volume_trans_array[Number($(`#speaker-volume-2`).val())],
                            volume3 = volume_trans_array[Number($(`#speaker-volume-3`).val())],
                            volume4 = volume_trans_array[Number($(`#speaker-volume-4`).val())],
                            volume5 = volume_trans_array[Number($(`#speaker-volume-5`).val())],
                            volume6 = volume_trans_array[Number($(`#speaker-volume-6`).val())];
                    $(`#speaker-volume-indicator-${i}`).html(value);
                    if (event.type === 'change') {
                        const speakerVolume = {
                            ...deviceInfo.misc_cfg?.speaker_volume,
                            volume1,
                            volume2,
                            volume3,
                            volume4,
                            volume5,
                            volume6,
                        };
                        const data = {
                            controlType:  "deviceSpeakerVolumeSet", 
                            thingIdentity: device.credentials.identity,
                            speakerVolume,
                        }
                        controlThing(data);
                    }
                });
            }

            //EQ设置
            $('#moreEditThingModal-eqCfg-tab').show();
            const eqCfgArray = ['75', '125', '250', '500', '1000', '2000', '4000', '8000'];
            eqCfgArray.forEach((eq, index) => {
                const initialValue = deviceInfo.misc_cfg?.eq_cfg[`eq_${eq}`] || 0
                $(`#eqCfg-range-${eq}`).val(initialValue);
                $(`#eqCfg-indicator-${eq}`).html(initialValue);

                $(`#eqCfg-range-${eq}`).on('input change', (event) => {
                    const value = $(event.currentTarget).val();
                            eq_75 = $(`#eqCfg-range-75`).val(),
                            eq_125 = $(`#eqCfg-range-125`).val(),
                            eq_250 = $(`#eqCfg-range-250`).val(),
                            eq_500 = $(`#eqCfg-range-500`).val(),
                            eq_1000 = $(`#eqCfg-range-1000`).val(),
                            eq_2000 = $(`#eqCfg-range-2000`).val(),
                            eq_4000 = $(`#eqCfg-range-4000`).val(),
                            eq_8000 = $(`#eqCfg-range-8000`).val();
                    $(`#eqCfg-indicator-${eq}`).html(value);
                    if (event.type === 'change') {
                        const eqCfg = {
                            ...deviceInfo.misc_cfg?.eq_cfg,
                            eq_75: Number(eq_75),
                            eq_125: Number(eq_125),
                            eq_250: Number(eq_250),
                            eq_500: Number(eq_500),
                            eq_1000: Number(eq_1000),
                            eq_2000: Number(eq_2000),
                            eq_4000: Number(eq_4000),
                            eq_8000: Number(eq_8000),
                        };
                        const data = {
                            controlType:  "deviceEqCfgSet", 
                            thingIdentity: device.credentials.identity,
                            eqCfg,
                        }
                        controlThing(data);
                    }
                });
            });
        }

        //其他设置
        const feature_list = _.cloneDeep(deviceInfo.feature_list);
        if (feature_list && !_.isEmpty(feature_list)) {
            //功率设置
            if (feature_list.has_device_power_cfg) {
                $('#moreEditThingModal-powerCfg-tab').show();
                let powerCfgTableData = [];
                const total_power = deviceInfo.device_power?.total_power || 0;
                if (total_power > 0) {
                    powerCfgTableData = [
                        {
                            //2-2-2-2
                            id: '2222', 
                            out_1_power: (total_power/4).toFixed(0), 
                            out_2_power: (total_power/4).toFixed(0), 
                            out_3_power: (total_power/4).toFixed(0), 
                            out_4_power: (total_power/4).toFixed(0)
                        },
                        {
                            //3-2-1-1
                            id: '3211', 
                            out_1_power: (total_power/2).toFixed(0), 
                            out_2_power: (total_power/4).toFixed(0), 
                            out_3_power: (total_power/8).toFixed(0), 
                            out_4_power: (total_power/8).toFixed(0)
                        },
                        {
                            //3-2-2-0
                            id: '3220', 
                            out_1_power: (total_power/2).toFixed(0), 
                            out_2_power: (total_power/4).toFixed(0), 
                            out_3_power: (total_power/4).toFixed(0), 
                            out_4_power: 0
                        },
                    ];
                    $powerCfgTable.bootstrapTable({
                        data: powerCfgTableData,
                        onCheck: function (row) {
                            let devicePowerPack = { ...deviceInfo.device_power };
                            if (row.id === '2222') {
                                devicePowerPack.out_1_power = 2;
                                devicePowerPack.out_2_power = 2;
                                devicePowerPack.out_3_power = 2;
                                devicePowerPack.out_4_power = 2;
                            } else if (row.id === '3211') {
                                devicePowerPack.out_1_power = 3;
                                devicePowerPack.out_2_power = 2;
                                devicePowerPack.out_3_power = 1;
                                devicePowerPack.out_4_power = 1;
                            } else if (row.id === '3220') {
                                devicePowerPack.out_1_power = 3;
                                devicePowerPack.out_2_power = 2;
                                devicePowerPack.out_3_power = 2;
                                devicePowerPack.out_4_power = 0;
                            }
                            const data = {
                                controlType:  "devicePowerCfgSet", 
                                thingIdentity: device.credentials.identity,
                                devicePowerPack,
                            }
                            controlThing(data);
                        }
                    });
                    $powerCfgTable.removeClass('table-bordered');
                    const powerStr = "" + 
                        deviceInfo.device_power?.out_1_power + 
                        deviceInfo.device_power?.out_2_power + 
                        deviceInfo.device_power?.out_3_power + 
                        deviceInfo.device_power?.out_4_power;
                    if (powerStr === "2222") {
                        $powerCfgTable.bootstrapTable('check', 0);
                    } else if (powerStr === "3211") {
                        $powerCfgTable.bootstrapTable('check', 1)
                    } else if (powerStr === "3220") {
                        $powerCfgTable.bootstrapTable('check', 2)
                    } else {
                        $powerCfgTable.bootstrapTable('uncheckAll')
                    }
                }
            }

            //音频矩阵
            if (feature_list.has_audio_matrix) {
                $('#moreEditThingModal-audioMatrix-tab').show();
                $('#audio_matrix-enable-moreEditThingModal').prop('checked', false);
                if (deviceInfo.audio_matrix?.enable) {
                    $('#audio_matrix-enable-moreEditThingModal').prop('checked', true);
                }
                $('#audio_matrix-audio_route-container').empty();
                const audio_route = deviceInfo.audio_matrix?.audio_route || [];
                audio_route.forEach((audio_route_item, index) => {
                    const $audio_route = $(`
                        <div class="mb-3 row">
                            <label 
                                for="audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal[]" 
                                class="col-sm-3 col-form-label"
                            >
                                输入${audio_route_item.in_channel}
                            </label>
                            <div class="col-sm-9">
                                <select 
                                    multiple="multiple" 
                                    name="audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal[]" 
                                    id="audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal"
                                    class="audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal audio_route-selector"
                                    data-in_channel="${audio_route_item.in_channel}"
                                >
                                </select>
                            </div>
                        </div>
                    `);
                    $('#audio_matrix-audio_route-container').append($audio_route);
                    $(`select[multiple].audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal`).multiselect({
                        columns  : 1,
                        search   : false,
                        selectAll: true,
                        texts    : {
                            placeholder    : '请选择',
                            selectedOptions: ' 选中',
                            selectAll      : '全选', 
                            unselectAll    : '取消全选',
                            noneSelected   : '没选中'
                        }
                    });
                    const audio_route_options = deviceInfo.out_channel?.channel?.map((channel)=>{
                        return {
                            name   : channel.aliase,
                            value  : channel.id,
                            checked: audio_route_item.out_channel.includes(channel.id)
                        }
                    });
                    $(`select[multiple].audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal`).multiselect('loadOptions', audio_route_options);
                    const audio_route_selectedOptionNames = audio_route_options.filter((item)=>item.checked).map(item=>item.name).join(', ');
                    // 通过 ID 选择器选择 <select> 元素
                    const audio_route_selectElement = $(`#audio_matrix-audio_route-${audio_route_item.in_channel}-moreEditThingModal`);
                    // 选择 <select> 元素的紧邻兄弟元素 div
                    const audio_route_msOptionsWrap = audio_route_selectElement.next(".ms-options-wrap.ms-has-selections");
                    // 确定已经找到该元素
                    if (audio_route_msOptionsWrap.length) {
                        // 查找 ms-options-wrap 下的 button > span 元素
                        const audio_route_buttonSpan = audio_route_msOptionsWrap.find("button > span");
                        if (audio_route_buttonSpan.length) {
                            audio_route_buttonSpan.html(audio_route_selectedOptionNames);
                        }
                    }
                });

                //音频矩阵-保存按钮
                $('#audio_matrix-confirm-button-moreEditThingModal').on('click', function () {
                    const enable = $('#audio_matrix-enable-moreEditThingModal').is(':checked');
                    const audio_route_selectors = $('.audio_route-selector');
                    const audio_route = [];
                    audio_route_selectors.each(function (index, element) {
                        const in_channel = $(element).data('in_channel');
                        const out_channel_array = $(element).val();
                        const out_channel = out_channel_array.join(',');
                        audio_route.push({
                            in_channel,
                            out_channel,
                        });
                    });
                    const audioMatrix = {
                        enable,
                        audio_route,
                    }
                    const cancelCallback = function () {
                        moreEditThingModal.show();
                    };
                    moreEditThingModal.hide();
                    showConfirmModal("修改设备音频矩阵，设备会自动重启，确定要进行此操作吗，是否继续？", () => {
                        const callback = function () {
                            moreEditThingModal.hide();
                            editThingModal.hide();
                        }
                        const data = {
                            controlType:  "deviceAudioMatrixCfgSet", 
                            thingIdentity: device.credentials.identity,
                            audioMatrix,
                        }
                        const cancelCallback = function () {
                            moreEditThingModal.show();
                        };
                        controlThing(data); 
                    }, cancelCallback);
                });
            }

            //收音机
            if (feature_list.has_radio && feature_list.radio_enable) {
                $('#moreEditThingModal-radio-tab').show();
                controlThing({controlType: 'deviceRadioFreqGet'});
                createRadioFreqList();
            }

            //U段配置
            if (feature_list.has_u_module && feature_list.u_module_enable) {
                $('#moreEditThingModal-u-channel-tab').show();
                $('#u-channel-moreEditThingModal').empty();
                for(let i = 0; i <= 39; i++) {
                    const $option = $(`<option value="${i}">${i === 0 ? '随机' : i}</option>`);
                    $('#u-channel-moreEditThingModal').append($option);
                }
                $('#u-channel-moreEditThingModal').val(deviceInfo.misc_cfg?.u_channel);
                $('#u-channel-moreEditThingModal').on('change', function () {
                    const uChannel = $(this).val();
                    const data = {
                        controlType:  "deviceUChannelSet", 
                        thingIdentity: device.credentials?.identity,
                        uChannel: Number(uChannel),
                    }
                    controlThing(data);
                });
            }

            //本地扩声
            if (feature_list.has_local_speech) {
                $('#moreEditThingModal-localSpeech-tab').show();
                //本地扩声开关
                $('#localSpeech-moreEditThingModal').prop('checked', false);
                if (deviceInfo.speech_cfg.speech_enable) {
                    $('#localSpeech-moreEditThingModal').prop('checked', true);
                }

                //本地扩声区域
                $('select[multiple].localSpeech-local_speech_area-moreEditThingModal').multiselect({
                    columns  : 1,
                    search   : false,
                    selectAll: true,
                    texts    : {
                        placeholder    : '请选择播放区域',
                        selectedOptions: ' 选中',
                        selectAll      : '全选', 
                        unselectAll    : '取消全选',
                        noneSelected   : '没选中'
                    }
                });
                const local_speech_area_options = deviceInfo.out_channel?.channel?.map((item)=>{
                    return {
                        name   : item.aliase,
                        value  : item.id,
                        checked: deviceInfo.speech_cfg.local_speech_area?.includes(item.id)
                    }
                });
                $('select[multiple].localSpeech-local_speech_area-moreEditThingModal').multiselect('loadOptions', local_speech_area_options );
                const local_speech_area_selectedOptionNames = local_speech_area_options.filter((item)=>item.checked).map(item=>item.name).join(', ');
                // 通过 ID 选择器选择 <select> 元素
                const local_speech_area_selectElement = $("#localSpeech-local_speech_area-moreEditThingModal");
                // 选择 <select> 元素的紧邻兄弟元素 div
                const local_speech_area_msOptionsWrap = local_speech_area_selectElement.next(".ms-options-wrap.ms-has-selections");
                // 确定已经找到该元素
                if (local_speech_area_msOptionsWrap.length) {
                    // 查找 ms-options-wrap 下的 button > span 元素
                    const local_speech_area_buttonSpan = local_speech_area_msOptionsWrap.find("button > span");
                    if (local_speech_area_buttonSpan.length) {
                        local_speech_area_buttonSpan.html(local_speech_area_selectedOptionNames);
                    }
                }

                //网络扩声
                $('#localSpeech-network_speech-moreEditThingModal-container').hide();
                $('#localSpeech-network_speech_area-moreEditThingModal-container').hide();
                $('#localSpeech-network_speech_area_Error').hide();
                $('#localSpeech-network_speech_area_Error').empty();
                if (deviceInfo.product_name?.includes('2204')) {
                    $('#localSpeech-network_speech-moreEditThingModal-container').show();
                    $('#localSpeech-network_speech-moreEditThingModal').prop('checked', false);
                    getNetworkSpeechAreaTree();
                    if (deviceInfo.speech_cfg?.network_speech_area) {
                        $('#localSpeech-network_speech-moreEditThingModal').prop('checked', true);
                        $('#localSpeech-network_speech_area-moreEditThingModal-container').show();
                        const network_speech_area_array = deviceInfo.speech_cfg?.network_speech_area ? 
                            deviceInfo.speech_cfg?.network_speech_area?.split(',').map((area)=>{
                                if(area.includes('_1')){
                                    return area.split('_')[0];
                                } else {
                                    return area;
                                }
                            }) : [];
                        selected_network_speech_areas = allThingsList.filter(thing => network_speech_area_array.includes(thing.credentials.identity));
                        createNetworkSpeechAreaList();
                    }

                    $('#localSpeech-network_speech-moreEditThingModal').on('change', function () {
                        const network_speech_enable = $(this).is(':checked');
                        if (network_speech_enable) {
                            $('#localSpeech-network_speech_area-moreEditThingModal-container').show();
                        } else {
                            selected_network_speech_areas = [];
                            createNetworkSpeechAreaList();
                            $('#localSpeech-network_speech_area-moreEditThingModal-container').hide();
                            $('#localSpeech-network_speech_area_Error').hide();
                            $('#localSpeech-network_speech_area_Error').empty();
                        }
                    });

                    // 点击添加广播区域按钮
                    $('#network_speech_areas_add_btn').click(function() {
                        moreEditThingModal.hide();
                        networkSpeechAreasAddModal.show();

                        $network_speech_area_tree.uncheckAll();
                        $network_speech_area_tree.collapseAll();  

                        const node = $network_speech_area_tree.getNodeByText('全部');
                        $network_speech_area_tree.expand(node);
                        if(selected_network_speech_areas) {
                            const selected_network_speech_areaIds = selected_network_speech_areas.map(playArea => playArea.id);
                            selected_network_speech_areaIds.forEach(areaId => {
                                const node = $network_speech_area_tree.getNodeById(areaId);
                                $network_speech_area_tree.check(node);
                            });
                        }
                    });

                    // 点击添加广播区域弹框确定按钮
                    $('#confirm_network_speech_areas_AddModalBtn').click(function() {
                        const checkedIds = $network_speech_area_tree.getCheckedNodes().filter(id => !id.includes("group_"));
                        const checked_network_speech_areas = allThingsList.filter(thing => checkedIds.includes(thing.id));
                        selected_network_speech_areas = checked_network_speech_areas.map(thing => thing);
                        closeNetworkSpeechAreasAddModal();
                    });

                    // 点击广播区域详情按钮-任务弹框
                    $('#network_speech_areas_detail_btn').click(function() {
                        if (selected_network_speech_areas.length) {
                            moreEditThingModal.hide();
                            networkSpeechAreasDetailModal.show();
                            createNetworkSpeechAreasAreasDetailList();
                        }
                    });

                }

                //音量
                $('#localSpeech-volume-moreEditThingModal').val(deviceInfo.speech_cfg?.volume || 0);
                $('#localSpeech-volume-label-moreEditThingModal').html(deviceInfo.speech_cfg?.volume || 0);
                $('#localSpeech-volume-moreEditThingModal').on('change', function () {
                    const volume = $(this).val();
                    $('#localSpeech-volume-label-moreEditThingModal').html(volume);
                });

                //触发灵敏度
                $('#localSpeech-trigger_threshold-moreEditThingModal').val(deviceInfo.speech_cfg?.trigger_threshold || 0);
                $('#localSpeech-trigger_threshold-label-moreEditThingModal').html(deviceInfo.speech_cfg?.trigger_threshold || 0);
                $('#localSpeech-trigger_threshold-moreEditThingModal').on('change', function () {
                    const trigger_threshold = $(this).val();
                    $('#localSpeech-trigger_threshold-label-moreEditThingModal').html(trigger_threshold);
                });

                //本地扩声保存按钮
                $('#localSpeech-confirm-button-moreEditThingModal').on('click', function () {
                    const save_local_speech = function () {
                        const speech_enable = $('#localSpeech-volume-moreEditThingModal').is(':checked');
                        const volume = $('#localSpeech-volume-moreEditThingModal').val();
                        const local_speech_area_list = $('select[multiple].localSpeech-local_speech_area-moreEditThingModal').val();
                        const trigger_threshold = $('#localSpeech-trigger_threshold-label-moreEditThingModal').val();
                        const network_speech_enable = $('#localSpeech-network_speech-moreEditThingModal').is(':checked');
                        // 广播区域
                        const network_speech_array = selected_network_speech_areas.map((area) => {
                            const identity = area.credentials.identity;
                            if (!identity.includes("_")) {
                                return `${identity}_1`;
                            } else {
                                return identity
                            }
                        });
                        const speechCfg = {
                            ...deviceInfo.speech_cfg,
                            speech_enable,
                            local_speech_area: local_speech_area_list.join(','),
                            trigger_threshold: Number(trigger_threshold),
                            volume: Number(volume),
                            network_speech_area: network_speech_array.join(','),
                        };
                        const data = {
                            controlType:  "deviceSpeechCfgSet", 
                            thingIdentity: device.credentials.identity,
                            speechCfg,
                        }
                        const callback = function () {
                            moreEditThingModal.hide();
                            editThingModal.hide();
                        }
                        controlThing(data, callback);
                    }

                    const cancelCallback = function () {
                        moreEditThingModal.show();
                    };

                    const run_save_local_speech = function () {
                        moreEditThingModal.hide();
                        showConfirmModal("修改设备扩声配置，设备会自动重启，确定要进行此操作吗，是否继续？", () => {
                            save_local_speech();
                        }, cancelCallback);
                    }

                    //当产品为 2204 且 网络扩声 开启时，需要选择网络扩声区域
                    if (deviceInfo.product_name.includes('2204')) {
                        const network_speech_enable = $('#localSpeech-network_speech-moreEditThingModal').is(':checked');
                        if (network_speech_enable) {
                            if (selected_network_speech_areas.length) {
                                run_save_local_speech();
                            } else {
                                $('#localSpeech-network_speech_area_Error').show();
                                $('#localSpeech-network_speech_area_Error').html(requiredMsg);
                            }
                        } else {
                            run_save_local_speech();
                        }
                    } else {
                        run_save_local_speech();
                    }
                });
            }

            //蓝牙配置
            if (feature_list.has_bluetooth_player) {
                $('#moreEditThingModal-bluetooth-tab').show();

                //蓝牙播放器开关
                $('#bluetooth-player-moreEditThingModal').prop('checked', false);
                if (deviceInfo.bluetooth_cfg.bluetooth_player_enable) {
                    $('#bluetooth-player-moreEditThingModal').prop('checked', true);
                }

                $('#bluetooth-player-moreEditThingModal').on('change', function () {
                    const bluetooth_player_enable = $(this).is(':checked');
                    const play_area_list = $('select[multiple].bluetooth-play-area-moreEditThingModal').val();
                    const bluetooth_delay = $('#bluetooth_delay-moreEditThingModal').val();
                    const password = $('#bluetooth-password-moreEditThingModal').val();
                    const bluetoothCfg = {
                        ...deviceInfo.bluetooth_cfg,
                        bluetooth_player_enable,
                        play_area: play_area_list.join(','),
                        bluetooth_delay: Number(bluetooth_delay),
                        password,
                    };
                    const data = {
                        controlType:  "deviceBluetoothCfgSet", 
                        thingIdentity: device.credentials.identity,
                        bluetoothCfg,
                    }
                    controlThing(data);
                });

                //蓝牙密码
                $('#bluetooth-password-moreEditThingModal').val(deviceInfo.bluetooth_cfg?.password || '');
                $('#bluetooth-password-moreEditThingModal').on('input change blur', function (event) {
                    const bluetooth_player_enable = $('#bluetooth-player-moreEditThingModal').is(':checked');
                    const play_area_list = $('select[multiple].bluetooth-play-area-moreEditThingModal').val();
                    const bluetooth_delay = $('#bluetooth_delay-moreEditThingModal').val();
                    const password = $(this).val();
                    if (password) {
                        $(`#bluetooth-password-moreEditThingModalError`).empty();
                        $('#bluetooth-password-moreEditThingModalError').hide();
                        if (event.type === 'blur') {
                            const bluetoothCfg = {
                                ...deviceInfo.bluetooth_cfg,
                                bluetooth_player_enable,
                                play_area: play_area_list.join(','),
                                bluetooth_delay: Number(bluetooth_delay),
                                password,
                            };
                            const data = {
                                controlType:  "deviceBluetoothCfgSet", 
                                thingIdentity: device.credentials.identity,
                                bluetoothCfg,
                            }
                            controlThing(data);
                        }
                    } else {
                        $(`#bluetooth-password-moreEditThingModalError`).html(requiredMsg);
                        $('#bluetooth-password-moreEditThingModalError').show();
                    }
                });

                //蓝牙延迟
                $('#bluetooth_delay-moreEditThingModal').val(deviceInfo.bluetooth_cfg?.bluetooth_delay || 0);
                $('#bluetooth_delay-moreEditThingModal').on('blur', function (event) {
                    const bluetooth_player_enable = $('#bluetooth-player-moreEditThingModal').is(':checked');
                    const play_area_list = $('select[multiple].bluetooth-play-area-moreEditThingModal').val();
                    const bluetooth_delay = $(this).val();
                    const password = $('#bluetooth-password-moreEditThingModal').val();
                    const bluetoothCfg = {
                        ...deviceInfo.bluetooth_cfg,
                        bluetooth_player_enable,
                        play_area: play_area_list.join(','),
                        bluetooth_delay: Number(bluetooth_delay),
                        password,
                    };
                    const data = {
                        controlType:  "deviceBluetoothCfgSet", 
                        thingIdentity: device.credentials.identity,
                        bluetoothCfg,
                    }
                    controlThing(data);
                });

                //蓝牙播放区域
                $('select[multiple].bluetooth-play-area-moreEditThingModal').multiselect({
                    columns  : 1,
                    search   : false,
                    selectAll: true,
                    texts    : {
                        placeholder    : '请选择播放区域',
                        selectedOptions: ' 选中',
                        selectAll      : '全选', 
                        unselectAll    : '取消全选',
                        noneSelected   : '没选中'
                    }
                });
                const bluetooth_play_area_options = deviceInfo.out_channel?.channel?.map((item)=>{
                    return {
                        name   : item.aliase,
                        value  : item.id,
                        checked: deviceInfo.bluetooth_cfg.play_area.includes(item.id)
                    }
                });
                $('select[multiple].bluetooth-play-area-moreEditThingModal').multiselect('loadOptions', bluetooth_play_area_options );
                const bluetooth_play_area_selectedOptionNames = bluetooth_play_area_options.filter((item)=>item.checked).map(item=>item.name).join(', ');
                const bluetooth_play_area_selectElement = $("#bluetooth-play-area-moreEditThingModal");
                const bluetooth_play_area_msOptionsWrap = bluetooth_play_area_selectElement.next(".ms-options-wrap.ms-has-selections");
                if (bluetooth_play_area_msOptionsWrap.length) {
                    // 查找 ms-options-wrap 下的 button > span 元素
                    const bluetooth_play_area_buttonSpan = bluetooth_play_area_msOptionsWrap.find("button > span");
                    if (bluetooth_play_area_buttonSpan.length) {
                        bluetooth_play_area_buttonSpan.html(bluetooth_play_area_selectedOptionNames);
                    }
                }
                $('select[multiple].bluetooth-play-area-moreEditThingModal').on('change', function () {
                    const bluetooth_player_enable = $('#bluetooth-player-moreEditThingModal').is(':checked');
                    const play_area_list = $(this).val();
                    const bluetooth_delay = $('#bluetooth_delay-moreEditThingModal').val();
                    const password = $('#bluetooth-password-moreEditThingModal').val();
                    const bluetoothCfg = {
                        ...deviceInfo.bluetooth_cfg,
                        bluetooth_player_enable,
                        play_area: play_area_list.join(','),
                        bluetooth_delay: Number(bluetooth_delay),
                        password,
                    };
                    const data = {
                        controlType:  "deviceBluetoothCfgSet", 
                        thingIdentity: device.credentials.identity,
                        bluetoothCfg,
                    }
                    controlThing(data);
                });
            }

            //状态灯、立体声、功放检测
            if (
                feature_list.has_status_led || 
                feature_list.has_stereo || 
                feature_list.has_amp_check
            ) {
                $('#moreEditThingModal-otherOperation-tab').show();

                // 状态灯、立体声、功放检测按钮状态显示
                function toggleButtonState(button, status) {
                    button.data('value', status);
                    if (status) {
                        button.removeClass('disabledBtn').addClass('primaryBtn');
                    } else {
                        button.removeClass('primaryBtn').addClass('disabledBtn');
                    }
                }

                // 状态灯、立体声、功放检测按钮初始化
                function setupButton(button, feature_status, enable_status, controlFunction) {
                    button.show();
                    button.data('value', enable_status);
                    toggleButtonState(button, enable_status);

                    button.on('click', function () {
                        const callback = function (status) {
                            moreEditThingModal.show();
                            toggleButtonState(button, status);
                        };

                        const cancelCallback = function () {
                            moreEditThingModal.show();
                        };

                        moreEditThingModal.hide();
                        showConfirmModal("确定要进行此操作吗，是否继续？", () => {
                            const current_status = Boolean(button.data('value'));
                            controlFunction(!current_status, callback);
                        }, cancelCallback);
                    });
                }
                
                // 功放检测
                if (feature_list.has_amp_check) {
                    setupButton(
                        $('#moreEditThingModal-otherOperation-ampCheckBtn'),
                        feature_list.has_amp_check,
                        feature_list.amp_check_enable,
                        function(new_status, callback) {
                            const data = {
                                controlType:  "deviceAmpCheckSet", 
                                thingIdentity: device.credentials.identity,
                                enabled: new_status,
                            }
                            controlThing(data, callback(new_status));
                        }
                    )
                } else {
                    $('#moreEditThingModal-otherOperation-ampCheckBtn').hide();
                }
            
                // 状态灯
                if (feature_list.has_status_led) {
                    setupButton(
                        $('#moreEditThingModal-otherOperation-ledBtn'),
                        feature_list.has_status_led,
                        feature_list.status_led_enable,
                        function(new_status, callback) {
                            const data = {
                                controlType:  "deviceLEDSet", 
                                thingIdentity: device.credentials.identity,
                                enabled: new_status,
                            }
                            controlThing(data, callback(new_status));
                        }
                    );
                } else {
                    $('#moreEditThingModal-otherOperation-ledBtn').hide();
                }
                // 立体声
                if (feature_list.has_stereo) {
                    setupButton(
                        $('#moreEditThingModal-otherOperation-stereoBtn'),
                        feature_list.has_stereo,
                        feature_list.stereo_enable,
                        function(new_status, callback) {
                            const data = {
                                controlType:  "deviceStereoSet", 
                                thingIdentity: device.credentials.identity,
                                enabled: new_status,
                            }
                            controlThing(data, callback(new_status));
                        }
                    );
                } else {
                    $('#moreEditThingModal-otherOperation-stereoBtn').hide();
                }
            }
        }
        
        //设置rangeInput的value值时，改变其背景色
        const rangeInputs = document.querySelectorAll('.rangeInput');
        rangeInputs.forEach(rangeInput => {
            rangeInput.addEventListener('input', () => updateRangeBackground(rangeInput));
            updateRangeBackground(rangeInput); // 初始化背景
        });
    }
    
    //获取日志
    controlThing({
        controlType:  "deviceLogGet",
        thingIdentity: device.credentials.identity
    });

    //设备操作按钮
    //重启设备
    $('#moreEditThingModal-deviceOperation-rebootBtn').on('click', function () {
        const callback = function () {
            moreEditThingModal.hide();
            editThingModal.hide();
        }
        const cancelCallback = function () {
            moreEditThingModal.show();
        }
        moreEditThingModal.hide();
        rebootThing(device.credentials.identity, callback, cancelCallback);
    });
    //删除设备
    $('#moreEditThingModal-deviceOperation-deleteBtn').on('click', function () {
        const callback = function () {
            moreEditThingModal.hide();
            editThingModal.hide();
        }
        const cancelCallback = function () {
            moreEditThingModal.show();
        }
        moreEditThingModal.hide();
        deleteThing(device.id, true, callback, cancelCallback);
    });
    //恢复出厂
    $('#moreEditThingModal-deviceOperation-resetBtn').on('click', function () {
        const callback = function () {
            moreEditThingModal.hide();
            editThingModal.hide();
            deleteThing(device.id, false);
        }
        const cancelCallback = function () {
            moreEditThingModal.show();
        }
        moreEditThingModal.hide();
        restoreThing(device.credentials.identity, callback, cancelCallback);
    });
}

//查看设备详情
function viewThing(id, thingIdentity) {
    window.location.href = '/ui/things/' + id;
}

//删除确认，接触通道关联
function deleteThing(thingID, showConfirm, callback, cancelCallback) {
    const disconnectThenDeleteThing = () => {
        fetch(`/ui/things/${thingID}/channelsInJSON?page=1&limit=1000`, {
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
                const channelsData = JSON.parse(data).channelsData;
                const channels = channelsData.groups;
                const fetchPromises = channels.map((channel) => disconnectThingsAndChannels(thingID, channel.id));
                Promise.all(fetchPromises).then(responses => {})
                    .then(jsonData => { handleDelete(thingID, callback) })
                    .catch(error => {
                        // 如果有任何错误发生，这里会捕获到
                        console.error('An error occurred:', error);
                    });
            });
    }
    if (showConfirm) {
        showConfirmModal("确定要删除所选设备吗？", () => {
            disconnectThenDeleteThing();
        }, cancelCallback);
    } else {
        disconnectThenDeleteThing();
    }
}

//删除设备
function handleDelete(thingID, callback) {
    fetch(`/ui/things/${thingID}`, {
        method: "DELETE",
    })
        .then(function (response) {
            if (!response.ok) {
                const errorMessage = response.headers.get("X-Error-Message");
                if (errorMessage) {
                    console.log(errorMessage);
                } else {
                    console.log(`Error: ${response.status}`);
                }
            } else {
                if (callback && typeof callback === "function") {
                    callback();
                }
                const reqOnlineStatus = sessionStorage.getItem("onlineStatus");
                window.location.href = `/ui/things?limit=1000&onlineStatus=${reqOnlineStatus}&showFullData=true`;
            }
        })
        .catch((error) => {
            if (callback && typeof callback === "function") {
                callback();
            }
            const reqOnlineStatus = sessionStorage.getItem("onlineStatus");
            window.location.href = `/ui/things?limit=1000&onlineStatus=${reqOnlineStatus}&showFullData=true`;
        });
}

//恢复出厂
function restoreThing(thingIdentity, callback, cancelCallback) {
    showConfirmModal("恢复出厂设置后需要重新添加该设备，确认继续？", () => {
        const data = {
            controlType:  "deviceRestore", 
            thingIdentity: thingIdentity,
        };
        controlThing(data, callback);
    }, cancelCallback);
}

//重启设备
function rebootThing(thingIdentity, callback, cancelCallback) {
    showConfirmModal("确定要重启所选设备吗？", () => {
        const data = {
            controlType:  "deviceReboot", 
            thingIdentity: thingIdentity,
        };
        controlThing(data, callback);
    }, cancelCallback);
}

//测试mqtt
function testMqtt () {
    const queryData = {
        channelID: "d1dc3422-584b-4ff0-bbc8-e57344b646d2",
        comID: "d1dc3422-584b-4ff0-bbc8-e57344b646d2",
        controlType: "deviceReboot",
        host: "192.168.13.235",
        thingIdentity: "rust_client",
        username: "test1@test.com"
    }
    fetch(`http://192.168.13.235:63001/testMqtt`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData),
    })
        .then(response => {
            console.error("testMqtt sent");
        })
        .catch((error) => {
            console.error("error testMqtt", error);
        });
}

//控制设备
function controlThing(controlThingData, callback = ()=>{}) {
    const domainID = sessionStorage.getItem("domainID");
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
                const comID = domainData.metadata["comID"];
                if (comID) {
                    const data = {
                        channelID: comID, 
                        ...controlThingData
                    }
                    postMessage(data, callback);
                }
            });
    } else {
        redirectToLogin();
    }
}

//更改设备在线状态
function changeOnlineStatus(thing){
    const onlineStatus = thing.metadata && thing.metadata.is_online === "1";
    if (onlineStatus) {
        $(`#${thing.id}-thingCardContent`).css('background', 'rgba(255, 255, 255, 0.8)');
        $(`#${thing.id}-rebootBtn`).css('display', 'block');
        $(`#${thing.id}-editBtn`).css('display', 'block');
    } else {
        $(`#${thing.id}-thingCardContent`).css('background', 'rgba(0,0,0,0.1)');
        $(`#${thing.id}-rebootBtn`).css('display', 'none');
        $(`#${thing.id}-editBtn`).css('display', 'none');
    }
    $(`#${thing.id}-deviceName`).html(thing.name);
    $(`#${thing.id}-deviceName`).prop("title", thing.name);
}

//轮询刷新thingslist，以实现监听things在线状态的
function refreshThingsData() {
    // 获取当前页面的完整URL
    const currentUrl = window.location.href;
    // 创建URL对象
    const urlObj = new URL(currentUrl);
    // 使用URL对象的searchParams属性获取URLSearchParams对象
    const searchParams = urlObj.searchParams;
    // 使用get方法从URLSearchParams对象中获取page和limit的值
    const page = searchParams.get('page') || 1;
    const limit = searchParams.get('limit') || 1000;
    const reqOnlineStatus = sessionStorage.getItem("onlineStatus") || 1;
    fetch(`/ui/things/thingsInJSON?page=${page}&limit=${limit}&onlineStatus=${reqOnlineStatus}&showFullData=true`, {
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
            const things = thingsData && typeof thingsData === 'object' && 
                thingsData.things && typeof thingsData.things === 'object' ?  
                    thingsData.things.filter((thing)=>{
                        //identity 中有下划线则表示为多通道，默认在设备页面隐藏
                        return thing.credentials.identity && !thing.credentials.identity.includes("_");
                    }) || [] : [];
            newDevices = {};
            // 所有在线\离线
            if (things.length) {
                things.forEach(device => {
                    newDevices[device.id] = {
                    id: device.id,
                    name: device.name,
                    credentials: device.credentials,
                    metadata: device.metadata,
                    status: device.status,
                    created_at: device.created_at,
                    updated_at: device.updated_at,
                    };
                });
                updateThingsGrid(things);
            } else {
                currentDevices = {};
                $(`#thingsGrid`).empty();
            };
        })
        .catch(error => {
            currentDevices = {};
            $(`#thingsGrid`).empty();
        });
}

//更新设备显示表格
function updateThingsGrid(devices) {
    const $thingsGrid = $('#thingsGrid');
    const currentDevicesLength = Object.keys(currentDevices).length;
    const newDevicesLength = Object.keys(newDevices).length;

    if (currentDevicesLength > newDevicesLength) {
        // 移除不在(查询在线时刚离线的，查询离线时刚上线的)的设备\
        Object.keys(currentDevices).forEach((curId)=>{
            if (
                (typeof newDevices === 'object' && Object.entries(newDevices).length === 0) || 
                (newDevices[curId] === null || newDevices[curId] === undefined) ||
                (typeof newDevices[curId] === 'object' && Object.entries(newDevices[curId]).length === 0)
            ) {
                // 移除不在(查询在线时离线的，查询离线时上线的)的设备
                $(`#${curId}-thingCard`).remove();
            }
        });
    } else if (currentDevicesLength < newDevicesLength) {
        // 新增(查询在线时刚上线的，查询离线时刚离线的)的设备]
        Object.keys(newDevices).forEach((newId)=>{
            if (
                (typeof currentDevices === 'object' && Object.entries(currentDevices).length === 0) || 
                (currentDevices[newId] === null || currentDevices[newId] === undefined) ||
                (typeof currentDevices[newId] === 'object' && Object.entries(currentDevices[newId]).length === 0)
            ) {
                const device = newDevices[newId];
                updateThingsGridDom(device);
            }
        });
    } else if (currentDevicesLength === newDevicesLength) {
        Object.keys(newDevices).forEach((newId)=>{
            const device = newDevices[newId];
            changeOnlineStatus(device);
        });
    }

    currentDevices = {};
    currentDevices = {...newDevices};
}

function updateThingsGridDom(device) {
    const deviceIcon = getDeviceIcon(device);
    const imgSpan = `<img loading="lazy" id="${device.id}-thingIcon" src="/images/${deviceIcon}" class="hoverCardIcon" />`;
    const btnSpan = `
        <div class="dropdown" style="float: right;">
            <button class="btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <i class="fa-solid fa-ellipsis"></i>
            </button>
            <ul class="dropdown-menu">
                <li style="display: none;">
                    <a class="dropdown-item" onclick="viewThing('${device.id}')">
                        <i class="fa-solid fa-info" style="width: 16px;"></i> 查看
                    </a>
                </li>
                <li 
                    id="${device.id}-rebootBtn" 
                    style="display: ${device.metadata && Number(device.metadata.is_online) === 1 ? 'block':'none'}"
                >
                    <a class="dropdown-item" onclick="rebootThing('${device.credentials.identity}')">
                        <i class="fa-solid fa-power-off" style="width: 16px;"></i> 设备重启
                    </a>
                </li>
                <li 
                    id="${device.id}-editBtn"
                    style="display: ${device.metadata && Number(device.metadata.is_online) === 1 ? 'block':'none'}"
                >
                    <a class="dropdown-item" onclick="editThing('${device.id}')">
                        <i class="fa-solid fa-gear" style="width: 16px;"></i> 设备设置
                    </a>
                </li>
                <li id="${device.id}-deleteBtn">
                    <a class="dropdown-item" onclick="deleteThing('${device.id}', true)">
                        <i class="fa-solid fa-trash-can" style="width: 16px;"></i> 设备删除
                    </a>
                </li>
            </ul>
        </div>
    `;
    const deviceChannelIconDiv = device.metadata && 
        device.metadata.out_channel_array && 
        device.metadata.out_channel_array.length > 1 ? 
            `
                <div class="row" style="position: absolute; bottom: 40px; padding-left: 24px;">
                    ${device.metadata.out_channel_array.map(($o, $i) => {
                        return `<i 
                                    class="fa-solid fa-${$i+1} deviceChannelIcon" 
                                    data-bs-toggle="tooltip" 
                                    data-bs-placement="bottom" 
                                    data-bs-title="${$o.aliase}" 
                                    title="${$o.aliase}"
                                >
                                </i>`
                    }).join('')}
                </div>
            ` : ``;
    const $thingCard = $(`
        <div class="cards-grid" id="${device.id}-thingCard">
            <div class="hoverCard card" id="${device.id}-thingCardContent" >
                <div class="card-body">
                    <div class="row">
                        <div class="col">
                            ${imgSpan}
                        </div>
                        <div class="col">
                            ${btnSpan}
                        </div>
                    </div>
                    <div class="row" style="margin-top:50px">
                        ${deviceChannelIconDiv}
                        <h5 
                            class="card-title truncate-text" 
                            data-bs-toggle="tooltip" 
                            data-bs-placement="bottom" 
                            data-bs-title="${device.name}"
                            title="${device.name}"
                        >
                            ${device.name}
                        </h5>
                    </div>
                </div>
            </div>
        </div>
    `);
    $(`#thingsGrid`).append($thingCard);
}

//根据在线类型获取设备列表
function getThingsList(onlineStatus, isRender) {
    currentDevices = {}, newDevices = {};
    fetch(`/ui/things/thingsInJSON?limit=1000&onlineStatus=${onlineStatus}&showFullData=true`, {
        method: "GET",
    })
        .then(response => {
            pollingIntervalIdThings = startPollingThings();
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); // 直接将流转换为JSON对象
        })
        .then(json => {
            const data = json.data;
            const thingsData = JSON.parse(data).thingsData;
            const things = thingsData.things.filter((thing)=>{
                //identity 中有下划线则表示为多通道，默认在设备页面隐藏
                return thing.credentials && !thing.credentials.identity.includes("_");
            }) || [];

            if (things.length) {
                things.forEach(device => {
                    currentDevices[device.id] = {
                        id: device.id,
                        name: device.name,
                        credentials: device.credentials,
                        metadata: device.metadata,
                        status: device.status,
                        created_at: device.created_at,
                        updated_at: device.updated_at,
                    };
                });
                if (isRender) {
                    updateThingsGrid(things);
                }
            }
        })
        .catch(error => {});
}

// 获取所有设备列表
function getAllThingsList(callback) {
    allThingsList = [];
    fetch(`/ui/things/thingsInJSON?limit=1000&onlineStatus=2&showFullData=true`, {
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
            const things = thingsData.things.filter((thing)=>{
                //identity 中有下划线则表示为多通道，默认在设备页面隐藏
                return thing.credentials && !thing.credentials.identity.includes("_");
            }) || [];

            if (things.length) {
                allThingsList = _.cloneDeep(things);
            }
            if (callback && typeof callback === 'function') {
                callback();
            }
        })
        .catch(error => {
            if (callback && typeof callback === 'function') {
                callback();
            }
        });
}

//给设备发信息
function postMessage(data, callback) {
    const url = window.location.href; // 获取当前页面的URL
    const address = new URL(url);
    const port =  sessionStorage.getItem("socketBridgePort") || "63001";
    const userInfoStr = sessionStorage.getItem("userInfo");
    userInfo = JSON.parse(userInfoStr);
    const queryData = {
        ...data,
        host: address.hostname,
        comID: data.channelID,
        username: userInfo.credentials.identity,
    }
    fetch(`http://${address.hostname}:${port}/controlDevice`, {
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

//扫描添加设备弹框中手动设置网络信息验证
function validateAndSave(property, postfix) {
    const $inputElement = $(`#${property}-deviceNetCfg${postfix}`);
    $inputElement.on('change blur keyup', function(event) {
        const deviceName = $(this).attr('data-device_name') || null;
        const deviceID = $(this).attr('data-device_id') || null;
        const deviceInfo = postfix ? 
            allThingsList.find(thing => thing.id === deviceID) : 
            scanNewThingsList.find(item => item.device_name === deviceName);
        const dhcp_enable = postfix ?  
            document.getElementById("dhcp_enable-deviceNetCfg-moreEditThingModal-auto").checked : 
            deviceInfo.netcfg.dhcp_enable;
        const value = $(this).val();
        const $errorElement = $(`#${property}Error${postfix}`);
        if (property === 'alias') {
            if (value) {
                $errorElement.empty();
                if (event.type === 'blur' && !postfix) {
                    scanNewThingsList = scanNewThingsList.map(item => {
                        if (item.device_name === deviceName) {
                            item[`device_aliase`] = value;
                        }
                        return item;
                    });
                }
            } else {
                $errorElement.html('请输入设备名称');
            }
        } else {
            if (!dhcp_enable) {
                if (IPV4REGX.test(value)) {
                    $errorElement.empty();
                    if (event.type === 'blur' && !postfix) {
                        scanNewThingsList = scanNewThingsList.map(item => {
                            if (item.device_name === deviceName) {
                                item.netcfg[`static_${property}`] = value;
                            }
                            return item;
                        });
                    }
                } else {
                    $errorElement.html(IPERRORMSG);
                }
            }
        }
    });
}

//扫描设备添加弹框设备列表-配置网络
function deviceNetCfg(e) {
    if (event.target.classList.contains('form-check-input')) {
        // 阻止事件冒泡或默认行为
        e.stopPropagation();
    } else {
        scanThingsModal.hide();
        deviceNetCfgModal.show();

        $('#aliasError').empty();
        $('#ipError').empty();
        $('#gatewayError').empty();
        $('#netmaskError').empty();
        $('#dns1Error').empty();
        $('#dns2Error').empty();

        // event.currentTarget：指向事件监听器所附加的元素，即 <div> 元素。
        // event.target：指向触发事件的实际元素，即 <span> 或 <img> 元素。
        const deviceName = e.currentTarget.dataset.device_name;
        const deviceInfo = scanNewThingsList.find((item)=>item.device_name === deviceName); 
        let ip = deviceInfo.netcfg.static_ip, 
            gateway = deviceInfo.netcfg.static_gateway,
            netmask = deviceInfo.netcfg.static_netmask, 
            dns1 = deviceInfo.netcfg.static_dns1, 
            dns2 = deviceInfo.netcfg.static_dns2;
            dhcp_enable = "0",
            disabled = false;
        if (deviceInfo.netcfg.dhcp_enable) {
            ip = deviceInfo.netcfg.dhcp_ip;
            gateway = deviceInfo.netcfg.dhcp_gateway;
            netmask = deviceInfo.netcfg.dhcp_netmask;
            dns1 = deviceInfo.netcfg.dhcp_dns1;
            dns2 = deviceInfo.netcfg.dhcp_dns2;
            dhcp_enable = "1";
            disabled = true;
        }

        $('#dhcp_enable-deviceNetCfg').val(dhcp_enable);
        $('#alias-deviceNetCfg').attr('data-device_name', deviceName);
        $('#ip-deviceNetCfg').attr('data-device_name', deviceName);
        $('#gateway-deviceNetCfg').attr('data-device_name', deviceName);
        $('#netmask-deviceNetCfg').attr('data-device_name', deviceName);
        $('#dns1-deviceNetCfg').attr('data-device_name', deviceName);
        $('#dns2-deviceNetCfg').attr('data-device_name', deviceName);
        $('#dhcp_enable-deviceNetCfg').attr('data-device_name', deviceName);
        $('#deviceNetCfgModal-confirm-button').attr('data-device_name', deviceName);

        $('#alias-deviceNetCfg').val(deviceInfo.device_aliase);
        $('#ip-deviceNetCfg').val(ip);
        $('#gateway-deviceNetCfg').val(gateway);
        $('#netmask-deviceNetCfg').val(netmask);
        $('#dns1-deviceNetCfg').val(dns1);
        $('#dns2-deviceNetCfg').val(dns2);

        $('#ip-deviceNetCfg').prop('disabled', disabled);
        $('#gateway-deviceNetCfg').prop('disabled', disabled);
        $('#netmask-deviceNetCfg').prop('disabled', disabled);
        $('#dns1-deviceNetCfg').prop('disabled', disabled);
        $('#dns2-deviceNetCfg').prop('disabled', disabled);
    }
}

//扫描添加设备弹框设备列表-勾选设备
function onSelectNewThing(e) {
    e.stopPropagation();
    const checkbox = e.target;
    const isChecked = checkbox.checked;
    const value = e.target.value;
    //判断是否全选，全反选
    if (value === 'selectAll') {
        if (isChecked) {
            selectedNewThingNames = scanNewThingsList.map((item)=>{
                return item.device_name;
            });
            scanNewThingsList.forEach((item)=>{
                $(`#checkbox_${item.device_name}`).prop("checked", true);
            });
        } else {
            selectedNewThingNames = [];
            scanNewThingsList.forEach((item)=>{
                $(`#checkbox_${item.device_name}`).prop("checked", false);
            });
        }
    } else {
        if (isChecked) {
            if (!selectedNewThingNames.includes(value)) {
                selectedNewThingNames.push(value);
            }
        } else {
            selectedNewThingNames = selectedNewThingNames.filter((name)=> name !== value)
        }
    }
    
    if (selectedNewThingNames.length) {
        $("#scan-add-thing-button").removeAttr("disabled");
        //判断全选框是否半勾选
        if (selectedNewThingNames.length === scanNewThingsList.length) {
            $(`#checkbox_selectAll`).prop("checked", true);
            $(`#checkbox_selectAll`).prop("indeterminate", false);
        } else {
            $(`#checkbox_selectAll`).prop("indeterminate", true);
            $(`#checkbox_selectAll`).prop("checked", false);
        }
    } else {
        $("#scan-add-thing-button").attr("disabled", true);
        $(`#checkbox_selectAll`).prop("indeterminate", false);
        $(`#checkbox_selectAll`).prop("checked", false);
    }
}

//显示扫描添加设备弹框设备列表
function showNewThingsGrid (thingsList, selectedThingsIds) {
    scanThingsModal.show();
    $(`#scanThingsGrid`).empty();

    //全选按钮
    const $selectAll = $(`
        <li class="list-group-item newThingItemList" style="background: whitesmoke;">
            <input 
                class="form-check-input" 
                type="checkbox" 
                value="selectAll" 
                id="checkbox_selectAll"
                onchange="onSelectNewThing(event)"
            />
            <label class="form-check-label" for="checkbox_selectAll" style="margin-left:5px">
                全选
            </label>
        </li>
    `);
    $(`#scanThingsGrid`).append($selectAll);

    //设备列表
    thingsList.forEach((thing, index)=>{
        const deviceIcon = getDeviceIcon(thing);
        const $thingList = $(`
            <li 
                class="list-group-item newThingItemList" 
                onclick="deviceNetCfg(event)"
                data-device_name="${thing.device_name}" 
            >
                <input 
                    class="form-check-input" 
                    type="checkbox" 
                    value="${thing.device_name}" 
                    id="checkbox_${thing.device_name}"
                    onchange="onSelectNewThing(event)"
                    data-device_name="${thing.device_name}" 
                    ${selectedThingsIds.includes(thing.device_name) ? `checked` : ``}
                />
                <label class="form-check-label" data-device_name="${thing.device_name}" >
                    <img
                        loading="lazy" 
                        src="/images/${deviceIcon}" 
                        style="height: 18px; margin-top: -3px; margin-left: 5px;"
                        data-device_name="${thing.device_name}" 
                    />
                    <span data-device_name="${thing.device_name}" >${thing.device_aliase}</span>
                </label>
            </li>
        `);
        $(`#scanThingsGrid`).append($thingList);
    });

    if (selectedThingsIds.length) {
        $("#scan-add-thing-button").removeAttr("disabled");
        //判断全选框是否半勾选
        if (selectedThingsIds.length === thingsList.length) {
            $(`#checkbox_selectAll`).prop("checked", true);
            $(`#checkbox_selectAll`).prop("indeterminate", false);
        } else {
            $(`#checkbox_selectAll`).prop("indeterminate", true);
            $(`#checkbox_selectAll`).prop("checked", false);
        }
    } else {
        $("#scan-add-thing-button").attr("disabled", true);
        $(`#checkbox_selectAll`).prop("indeterminate", false);
        $(`#checkbox_selectAll`).prop("checked", false);
    }
}

//获取udp组播扫描到的新设备
function scanNewThings(){
    const url = window.location.href; // 获取当前页面的URL
    const address = new URL(url);
    const port =  sessionStorage.getItem("socketBridgePort") || "63001";
    scanNewThingsList = []; selectedNewThingNames = [];
    fetch(`http://${address.hostname}:${port}/devices`, {
        method: "GET",
        "Authorization": getCookie('session'),
    })
        .then(response => {
            // 检查响应的内容类型是否为JSON
            if (
                response.headers.get('Content-Type') && 
                response.headers.get('Content-Type').includes('application/json')
            ) {
                // 检查响应的内容长度
                if (response.headers.get('Content-Length') === '0') {
                    // 如果内容长度为0，返回一个空对象或执行其他逻辑
                    return {};
                }
                // 返回响应的JSON解析结果
                return response.json();
            } else {
                // 如果内容类型不是JSON，抛出错误或执行其他逻辑
                throw new Error('Response content type is not JSON');
            }
        })
        .then(json => {
            if (json && JSON.stringify(json) !== '{}' && json.length) {
                scanNewThingsList = json.map((item)=>{
                    return JSON.parse(item.message)
                })
                showNewThingsGrid(scanNewThingsList, selectedNewThingNames)
            } else {
                showAlert("info", "没有可添加设备");
            }
        })
}

//添加扫描设备
function addScanNewThings() {
    //获取当前domain的comID号
    const domainID = sessionStorage.getItem("domainID");
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
            const comID = domainData.metadata["comID"];
            const selectedNewThings = scanNewThingsList.filter(item => selectedNewThingNames.includes(item.device_name));
            const queryData = selectedNewThings.filter((item)=>{
                //判断该设备是否已经存在，已存在自动忽略，不能重复添加
                const targetThing = allThingsList.find((thing) => item.device_name === thing.credentials.identity);
                if (targetThing && targetThing.id) {
                    return false;
                } else {
                    return true;
                }
            }).map((thing)=>{
                return {
                    name: thing.device_aliase,
                    credentials: {
                        identity: thing.device_name,
                        secret: thing.device_name,
                    },
                    tags: [],
                    metadata: {
                        product_name: thing.product_name,
                        is_online: "0",
                        out_channel: thing.out_channel && thing.out_channel.channel ? `${thing.out_channel.channel.length}` : "0",
                        out_channel_array: thing.out_channel && thing.out_channel.channel ? thing.out_channel.channel : [],
                        is_channel: "0",
                        aliase: thing.out_channel && thing.out_channel.channel && thing.out_channel.channel.length ? 
                            thing.device_aliase + "_" + thing.out_channel.channel[0].aliase : thing.device_aliase
                    }
                }
            });
            if (queryData && queryData.length) {
                fetch(`/ui/things/batch`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(queryData),
                })
                    .then(response => {
                        const url = window.location.href; // 获取当前页面的URL
                        const address = new URL(url);
                        const port =  sessionStorage.getItem("socketBridgePort") || "63001";
                        const newQueryData = selectedNewThings.map((item)=>{
                            item.tenant_id = comID;
                            item.netcfg.mqtt_server =  address.hostname || "nxt-gateway.local";
                            return item;
                        });
                        // 添加成功后需要向UDP发送回执
                        fetch(`http://${address.hostname}:${port}/addDeviceReply`, {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Authorization": getCookie('session'),
                            },
                            body: JSON.stringify(newQueryData),
                        })
                            .then(response => {
                                // 获取当前 URL
                                const currentUrl = new URL(window.location.href);
                                const reqOnlineStatus = sessionStorage.getItem("onlineStatus");
                                // 修改查询参数
                                currentUrl.searchParams.set('onlineStatus', reqOnlineStatus);
                                // 跳转到新的 URL
                                window.location.href = currentUrl.toString();
                            });
                    });
            } else {
                scanThingsModal.hide();
            }
        });
}