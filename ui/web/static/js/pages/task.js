const requiredMsg = '不能为空', 
        endTimeBeforeStartTimeMsg = '结束时间不能早于开始时间',
        playbackCycleWeekMsg = '当播放周期为每周时, 必须选择一周中的某一天或者某几天',
        taskModal = new bootstrap.Modal(document.getElementById("taskModal")), // 任务弹框
        syncTaskModal = new bootstrap.Modal(document.getElementById("syncTaskModal")), // 同步任务弹框
        sourceModal = new bootstrap.Modal(document.getElementById("sourceModal")), // 音源弹框
        filesModal = new bootstrap.Modal(document.getElementById("filesModal")), // 文件弹框
        inputChannelsModal = new bootstrap.Modal(document.getElementById("inputChannelsModal")), // 输入通道弹框
        playAreasAddModal = new bootstrap.Modal(document.getElementById("playAreasAddModal")), // 新增播放区域弹框
        playAreasDetailModal = new bootstrap.Modal(document.getElementById("playAreasDetailModal")), // 播放区域详情弹框
        $filesModalTable = $('#filesModalTable'), // 文件弹框表格
        $syncTaskTable = $('#syncTaskTable'), // 同步任务弹框表格
        protocol = window.location.protocol,
        hostname = window.location.hostname,
        port =  sessionStorage.getItem("socketBridgePort") || "63001",
        domainID = sessionStorage.getItem("domainID"), // 当前机构ID
        userInfoStr = sessionStorage.getItem("userInfo"),
        userInfo = JSON.parse(userInfoStr),
        minioBridgePort =  sessionStorage.getItem("minioBridgePort") || "9102";
let comID = "",
    isListAllTask = false, // 是否显示全部任务
    selectedDate = moment().format('YYYY-MM-DD'), // 当前选中日期
    showMoreSettingTaskModal = false,  // 是否显示更多设置弹框-任务弹框
    showMoreSettingSourceModal = false, // 是否显示更多设置弹框-音源弹框
    selectedFilesModal = [], // 文件弹框选中文件列表
    selectedPlayAreas = [], // 播放区域弹框选中播放区域列表
    playAreaTreeData = [], // 播放区域树数据
    $playAreaTree = null, // 播放区域树
    addPlayAreaModalIsOpenedFromDetailModal = false, // 是否从播放区域详情弹框打开添加播放区域弹框
    selectedSourceObject = {
        files:[], // 音源弹框选中音源对象
        devices: [], // 音源弹框选中设备对象
    },
    taskModalType = 'add', // 任务弹框类型-add:新建日程, edit:编辑日程
    taskDateBadgeCurrentValue = 0, // 任务页面左上角日期徽章当前值
    taskDateBadgeTargetValue = 0, // 任务页面左上角日期徽章目标值
    taskDateBadgeIncrement = 1, // 任务页面左上角日期徽章增长步长
    allThingsList = [], // 所有设备列表
    breadCrumbFolderList = [], //当前选中文件夹列表-文件弹框
    currentFolderKey = "", //当前文件夹key-文件弹框;
    originalTaskList = [], //原始任务列表
    syncStatusTableList = [], //同步状态列表
    allTaskList = []; //全部任务列表

$(function() {
    initPage();

    // 初始化设定页面标题为当天
    $('#taskDateTitle').html(selectedDate);

    // 点击全部/当天按钮时，切换任务列表
    $('#allTasksToggleBtn').click(function() {
        onClickAllTasksToggleBtn();
    });

    // 点击新建日程按钮时，显示新建日程模态框
    $('#addTaskBtn').click(function() {
        initAddTaskModal();
        createPlayAreasList();
        taskModal.show();
    });

    // 点击添加播放区域按钮-任务弹框
    $('#playAreasAddBtn').click(function() {
        addPlayAreaModalIsOpenedFromDetailModal = false;
        taskModal.hide();
        playAreasAddModal.show();

        $playAreaTree.uncheckAll();
        $playAreaTree.collapseAll();  

        const node = $playAreaTree.getNodeByText('全部');
        $playAreaTree.expand(node);
        if(selectedPlayAreas) {
            const selectedPlayAreasId = selectedPlayAreas.map(playArea => playArea.id);
            selectedPlayAreasId.forEach(playAreaId => {
                const node = $playAreaTree.getNodeById(playAreaId);
                $playAreaTree.check(node);
            });
        }
    });

    // 点击添加播放区域弹框确定按钮-添加播放区域弹框
    $('#confirmPlayAreasAddModalBtn').click(function() {
        const checkedIds = $playAreaTree.getCheckedNodes().filter(id => !id.includes("group_"));
        const checkedPlayAreas = allThingsList.filter(thing => checkedIds.includes(thing.id));
        selectedPlayAreas = checkedPlayAreas.map(thing => thing);
        closePlayAreasAddModal();
    });

    // 点击播放区域详情按钮-任务弹框
    $('#playAreasDetailBtn').click(function() {
        taskModal.hide();
        playAreasDetailModal.show();
        createPlayAreasDetailList();
    });

    // 点击播放区域详情弹框确定按钮-播放区域详情弹框
    $('#confirmPlayAreasDetailModalBtn').click(function() {
        playAreasDetailModal.hide();
        taskModal.show();
        createPlayAreasList();
    });

    // 播放周期选择框变化时，改变周数选择框是否显示-任务弹框
    $('#playbackCycle').on('change blur', function() {
        const playbackCycleValue = $(this).val();
        if (!playbackCycleValue) {
            $('#playbackCycleError').html(requiredMsg);
            $('#playbackCycleError').show();
        } else {
            $('#playbackCycleError').hide();
            if (playbackCycleValue === 'week') {
                $('#weekCheckboxGroup').show();
            } else {
                $('#weekCheckboxGroup').hide();
            }
        }
    });

    // 音量微调选择框变化时，改变音量标签-任务弹框
    $('#volumeControl').on('input change blur', (event) => {
        const volumeControlValue = $(this).val();
        $('#volumeLabel').html(volumeControlValue);
    });

    // 点击更多设置按钮时，切换显示更多设置-任务弹框
    $('#moreSettingBtnTaskModal').click(function() {
        showMoreSettingTaskModal = !showMoreSettingTaskModal;
        $('#moreSettingBtnTaskModal').empty();
        if (showMoreSettingTaskModal) {
            $('#moreSettingBtnTaskModal').append($(`<i class="fa-solid fa-chevron-up"></i>`));
            $('#moreSettingContainerTaskModal').show();
        } else {
            $('#moreSettingBtnTaskModal').append($(`<i class="fa-solid fa-chevron-down"></i>`));
            $('#moreSettingContainerTaskModal').hide();
        }
    });

    // 验证表单日程名称是否为空-任务弹框
    $('#taskName').on('change blur keyup', function(event) {
        const value = $(this).val();
        if (value) {
            $(`#taskNameError`).empty();
            $('#taskNameError').hide();
        } else {
            $(`#taskNameError`).html(requiredMsg);
            $('#taskNameError').show();
        }
    });

    // 验证表单音源名称是否为空-任务弹框
    $('#sourceName').on('change blur keyup', function(event) {
        const value = $(this).val();
        if (value) {
            $(`#sourceNameError`).empty();
            $('#sourceNameError').hide();
        } else {
            $(`#sourceNameError`).html(requiredMsg);
            $('#sourceNameError').show();
        }
    });

    // 开始时间初始化-任务弹框
    const startTimeFormatter = $(`#startTime`).attr('data-formatter');
    jeDate(`#startTime`, {
        onClose:false,
        format: startTimeFormatter,
        clearfun:function(elem, val) {
            $('#startTimeError').html(requiredMsg);
            $('#startTimeError').show();
        },
        donefun: function(obj){
            const startTime = obj.val ? moment(obj.val) : null;
            const endTime = $(`#endTime`).val();
            if (startTime) {
                if (!endTime) {
                    const newEndTime = startTime.add(1, 'seconds');
                    $(`#endTime`).val(newEndTime.format('YYYY-MM-DD HH:mm:ss'));
                    $('#endTimeError').hide();
                }
                $('#startTimeError').hide();
            } else {
                $('#startTimeError').html(requiredMsg);
                $('#startTimeError').show();
            }
        },
    });
    
    // 结束时间初始化-任务弹框
    const endTimeFormatter = $(`#endTime`).attr('data-formatter');
    jeDate(`#endTime`, {
        onClose:false,
        format: endTimeFormatter,
        clearfun:function(elem, val) {
            $('#endTimeError').html(requiredMsg);
            $('#endTimeError').show();
        },
        donefun: function(obj){
            const endTime = obj.val;
            if (!endTime) {
                $('#endTimeError').html(requiredMsg);
                $('#endTimeError').show();
            } else {
                const startTime = $(`#startTime`).val();
                if (!startTime) {
                    $('#endTimeError').html('请先设置开始时间');
                    $('#endTimeError').show();
                    $('#endTime').val('');
                } else {
                    // 将时间字符串转换为 Date 对象
                    const startTimeDate = new Date(startTime.replace(' ', 'T'));
                    const endTimeDate = new Date(endTime.replace(' ', 'T'));

                    // 比较两个 Date 对象
                    if (endTimeDate < startTimeDate) {
                        $(`#endTimeError`).html(endTimeBeforeStartTimeMsg);
                        $('#endTimeError').show();
                        $('#endTime').val('');
                    } else {
                        $('#endTimeError').hide();
                    }
                }
            }
        },
    });
    
    // 当选择开始时间时，如果结束时间为空，则自动填充结束时间-任务弹框
    $(`#startTime`).on('change blur', function(event) {
        const startTime = $(this).val();
        const endTime = $(`#endTime`).val();
        if (startTime) {
            if (!endTime) {
                $(`#endTime`).val(startTime);
            }
        } else {
            $(`#startTimeError`).html(requiredMsg);
            $('#startTimeError').show();
        }
    });

    // 当选择结束时间时，如果开始时间为空，则自动填充开始时间-任务弹框
    $(`#endTime`).on('change blur', function(event) {
        const endTime = $(this).val();
        const startTime = $(`#startTime`).val();
        if (endTime) {
            // 将时间字符串转换为 Date 对象
            const startTimeDate = new Date(startTime.replace(' ', 'T'));
            const endTimeDate = new Date(endTime.replace(' ', 'T'));

            // 比较两个 Date 对象
            if (endTimeDate < startTimeDate) {
                $(`#endTimeError`).html(endTimeBeforeStartTimeMsg);
                $('#endTimeError').show();
            } else {
                $('#endTimeError').hide();
            }
        } else {
            $(`#endTimeError`).html(requiredMsg);
            $('#endTimeError').show();
        }
    });

    // 验证表单播放周期是否为空-任务弹框
    $('.taskWeekCheckbox').change(function() {
        let checkedWeeks = [];
        $('.taskWeekCheckbox:checked').each(function() {
            checkedWeeks.push($(this).val());
        });
        if (!checkedWeeks.length) {
            $(`#playbackCycleError`).html(playbackCycleWeekMsg);
            $('#playbackCycleError').show();
        } else {
            $('#playbackCycleError').hide();
        }
    });

    // 点击新建日程表单的提交按钮时，验证表单数据是否合法-任务弹框
    $(`#addTaskForm`).on('submit', function(e) {
        e.preventDefault();
        const taskName = $(`#taskName`).val();
        const sourceName = $(`#sourceName`).val();
        const startTime = $(`#startTime`).val();
        const endTime = $(`#endTime`).val();
        const playbackCycleValue = $(`#playbackCycle`).val();

        if(!taskName || !sourceName || !playbackCycleValue || !startTime || !endTime || !selectedPlayAreas || !selectedPlayAreas.length) {
            if (!taskName) {
                $(`#taskNameError`).html(requiredMsg);
                $('#taskNameError').show();
            } 
            if (!sourceName) {
                $(`#sourceNamerror`).html(requiredMsg);
                $('#sourceNameError').show();
            } 
            if (!playbackCycleValue || playbackCycleValue === '0') {
                $('#playbackCycleError').html(requiredMsg);
                $('#playbackCycleError').show();
            } 
            if (!startTime) {
                $(`#startTimeError`).html(requiredMsg);
                $('#startTimeError').show();
            }
            if (!endTime) {
                $(`#endTimeError`).html(requiredMsg);
                $('#endTimeError').show();
            }
            if (!selectedPlayAreas || !selectedPlayAreas.length) {
                $('#playAreaError').html(requiredMsg);
                $('#playAreaError').show();
            }
            return;
        } else {
            const repeatNumSwitchChecked = $(`#repeatNumSwitch`).is(':checked');
            if (repeatNumSwitchChecked) {
                if (startTime && endTime) {
                    // 将时间字符串转换为 Date 对象
                    const startTimeDate = new Date(startTime.replace(' ', 'T'));
                    const endTimeDate = new Date(endTime.replace(' ', 'T'));
                    // 比较两个 Date 对象
                    if (endTimeDate < startTimeDate) {
                        $(`#endTimeError`).html(endTimeBeforeStartTimeMsg);
                        $('#endTimeError').show();
                        return;
                    }
                }
            }
            
            if (playbackCycleValue === 'week') {
                let checkedWeeks = [];
                $('.taskWeekCheckbox:checked').each(function() {
                    checkedWeeks.push($(this).val());
                });
                if (!checkedWeeks.length) {
                    $(`#playbackCycleError`).html(playbackCycleWeekMsg);
                    $('#playbackCycleError').show();
                    return;
                }
            }
        
            let queryData = {}, successMsg = '';
            if (taskModalType === 'add') {
                queryData = {};
                successMsg= '日程创建成功';
            } else {
                const taskUUID = $('#taskModalConfirmBtn').attr('data-uuid');
                const task = originalTaskList.find(task => task.uuid === taskUUID);
                queryData = {...task};
                queryData.uuid = taskUUID;
                successMsg= '日程编辑成功';
            }
            queryData.username = userInfo.credentials.identity;
            // 任务名称
            queryData.name = $('#taskName').val();
            // 任务开始时间
            queryData.start_date = $('#startTime').val();
            // 播放周期
            const playbackCycle = $('#playbackCycle').val();
            if (playbackCycle === 'once') {
                // 单次
                queryData.repeat = 0;
            } else if (playbackCycle === 'day') {
                // 日重复
                queryData.repeat = 1;
            } else if (playbackCycle === 'week') {
                // 周重复
                queryData.repeat = 2;
                const weekArray = [];
                for (let i = 1; i <= 7; i++) {
                    if ($(`#weekCheckbox${i}`).is(':checked')) {
                        weekArray.push(i);
                    }
                }
                queryData.wday = weekArray.join(',');
            } else if (playbackCycle === 'month') {
                // 月重复
                queryData.repeat = 3;
            } else if (playbackCycle === 'year') {
                // 年重复
                queryData.repeat = 4;
            }
            // 音源
            if (selectedSourceObject && selectedSourceObject.files.length) {
                queryData.source = 0;
                const songsArray = selectedSourceObject.files.map(file => {
                    return file.key.replace(`${comID}/`, 'oss://')
                });
                queryData.songs = songsArray.join(',');
            }
            // 背景音
            const background = $('#backgroundSource').val();
            if (background) {
                if (background === 'file') {
                    queryData.background = 0;
                }
            }
            // 播放范围
            const out_channel_array = selectedPlayAreas.map((area) => {
                const identity = area.credentials.identity;
                if (!identity.includes("_")) {
                    return `${identity}_1`;
                } else {
                    return identity;
                }
            });
            queryData.out_channel = out_channel_array.join(',');
            // 结束时间
            queryData.end_date = $('#endTime').val();
            // 重复次数
            queryData.cyclic_times = Number($('#repeatNum').val());
            if ($(`#repeatNumSwitch`).is(':checked')) {
                const startTime = moment(queryData.start_date);
                const endTime = moment(queryData.end_date);
                const durationInSeconds = endTime.diff(startTime, 'seconds');
                queryData.duration = durationInSeconds;
                delete queryData.end_date;
            }
            // 随机播放
            queryData.song_play_type = 0;
            if ($(`#randomPlay`).is(':checked')) {
                queryData.song_play_type = 1;
            }
            // 音量微调
            queryData.master_volume = Number($('#volumeControl').val());
            // 优先级
            for (let i = 1; i <= 3; i++) {
                if ($(`#level${i}`).is(':checked')) {
                    queryData.priority = i;
                }
            }
            // 回调函数
            const callback = ()=>{
                showAlert('success', successMsg);
                taskModal.hide();
                loadTaskLists(true);
            }
            if (taskModalType === 'add') {
                httpAddTask(queryData, callback);
            } else {
                httpUpdateTask(queryData, true, callback);
            }
        }
    });

    // 重复次数开关-任务弹框
    $('#repeatNumSwitch').on('change', function() {
        if ($(this).is(':checked')) {
            $('#endTimeContainer').hide();
            $('#endTime').prop('disabled', true);
            $('#endTimeError').hide();
        } else {
            $('#endTimeContainer').show();
            $('#endTime').prop('disabled', false);
        }
    });

    //重复次数下拉框生成-任务弹框
    $('#repeatNum').empty();
    for(let i = 1; i <= 100; i++) {
        const $option = $(`<option value="${i}">${i}</option>`);
        $('#repeatNum').append($option);
    }

    //点击音源选择按钮-打开音源弹框
    $('#selectSourceBtn').click(function() {
        showMoreSettingSourceModal = false;
        $('#moreSettingBtnSourceModal').empty();
        $('#moreSettingBtnSourceModal').append($(`<i class="fa-solid fa-chevron-down"></i>`));
        $('#moreSettingContainerSourceModal').hide();
        createSourceModalFileList();
        createSourceModalDeviceList();
        taskModal.hide();
        sourceModal.show();
    });

    // 点击更多设置按钮时，切换显示更多设置-音源弹框
    $('#moreSettingBtnSourceModal').click(function() {
        showMoreSettingSourceModal = !showMoreSettingSourceModal;
        $('#moreSettingBtnSourceModal').empty();
        if (showMoreSettingSourceModal) {
            $('#moreSettingBtnSourceModal').append($(`<i class="fa-solid fa-chevron-up"></i>`));
            $('#moreSettingContainerSourceModal').show();
        } else {
            $('#moreSettingBtnSourceModal').append($(`<i class="fa-solid fa-chevron-down"></i>`));
            $('#moreSettingContainerSourceModal').hide();
        }
    });

    // 点击音源弹框中的关闭按钮时，隐藏音源弹框
    $('#sourceModalConfirmBtn').click(function() {
        sourceModal.hide();
        taskModal.show();
        if (selectedSourceObject) {
            if (
                selectedSourceObject.files && selectedSourceObject.files.length &&
                selectedSourceObject.devices && selectedSourceObject.devices.length
            ) {
                $('#sourceName').val('文件 + 采播');
                $('#sourceNameError').hide();
            } else {
                if (selectedSourceObject.files && selectedSourceObject.files.length) {
                    $('#sourceName').val('文件');
                    $('#sourceNameError').hide();
                }
                if (selectedSourceObject.devices && selectedSourceObject.devices.length) {
                    $('#sourceName').val('采播');
                    $('#sourceNameError').hide();
                }
            }
        }
    });

    $filesModalTable.bootstrapTable({});
    $filesModalTable.removeClass('table-bordered');
    // 点击添加文件按钮打开文件弹框
    $('#addSourceModalFileBtn').click(function() {
        sourceModal.hide();
        filesModal.show();
        loadFilesTable("");
    });

    // 文件弹框中点击确认按钮时，隐藏文件弹框并更新音源弹框中的文件列表
    $('#confirmFileBtn').click(function() {
        filesModal.hide();
        sourceModal.show();
        const selectedRows = $filesModalTable.bootstrapTable('getSelections');
        if (!selectedSourceObject.files.length) {
            selectedSourceObject.files = selectedRows;
        } else {
            // 将b中在a中不存在的项找到
            const itemsToAdd = selectedRows.filter(itemB => !selectedSourceObject.files.some(itemA => itemA.key === itemB.key));
            // 将这些项添加到a中
            const updatedFiles = selectedSourceObject.files.concat(itemsToAdd);
            selectedSourceObject.files = updatedFiles;
        }
        createSourceModalFileList();
    });

    const $inputChannelsModalTable = $('#inputChannelsModalTable');
    $inputChannelsModalTable.bootstrapTable({
        data: [],
    });
    // 点击添加设备按钮打开设备弹框
    $('#addSourceModalDeviceBtn').click(function() {
        sourceModal.hide();
        inputChannelsModal.show();
        $inputChannelsModalTable.bootstrapTable('load', []);
    });
    
    // 设备弹框中点击确认按钮时，隐藏设备弹框并更新音源弹框中的设备列表
    $('#confirmInputChannelsBtn').click(function() {
        inputChannelsModal.hide();
        sourceModal.show();
        const selectedRows = $inputChannelsModalTable.bootstrapTable('getSelections');
        selectedSourceObject.devices = selectedRows;
        createSourceModalDeviceList();
    });

    // 高亮日历侧边栏中的今天
    highlightTodayOnCalendar();

    // 获取播放区域列表树
    getPlayAreaTree();

    //设置rangeInput的value值时，改变其背景色
    const rangeInputs = document.querySelectorAll('.rangeInput');
    rangeInputs.forEach(rangeInput => {
        rangeInput.addEventListener('input', () => updateRangeBackground(rangeInput));
        updateRangeBackground(rangeInput); // 初始化背景
    });
});

// 页面初始化时，获取任务列表
function initPage () {
    if (domainID) {
        initTaskCalender([]);
        createTaskList(selectedDate);

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
                loadTaskLists(true);
            });
    } else {
        redirectToLogin();
    }
}

// 更新任务运行状态
function handleUpdateTaskRunningStatus(uuid, runningStatus) {
    allTaskList = allTaskList.map((task) => {
        if (uuid && task.uuid === uuid) {
            if (runningStatus) {
                task.running = true;
            } else {
                task.running = false;
            }
        }
        return task;
    });
    renderTaskCalenderAndTaskList(allTaskList, selectedDate);
}

// 渲染生成日历和任务列表
function renderTaskCalenderAndTaskList (taskList, date) {
    let schedules = [];
    const runningTasksDates = taskList.filter(task => task.running).map(task => task.datesArray);
    const runningTasksDatesFlatArray = runningTasksDates.flat(Infinity); // 将嵌套数组扁平化
    const runningTasksDatesUniqueArray = [...new Set(runningTasksDatesFlatArray)]; // 去除重复元素
    const runningTasksScheules = runningTasksDatesUniqueArray.map(date => {
        return {
            name: 'ad',
            date: date, 
        }
    });

    const stoppedTasksDates = taskList.filter(task => !task.running).map(task => task.datesArray);
    const stoppedTasksDatesFlatArray = stoppedTasksDates.flat(Infinity); // 将嵌套数组扁平化
    const stoppedTasksDatesUniqueArray = [...new Set(stoppedTasksDatesFlatArray)]; // 去除重复元素
    const stoppedTasksScheules = stoppedTasksDatesUniqueArray.filter((date)=> !runningTasksDatesUniqueArray.includes(date)).map(date => {
        return {
            name: 'offer',
            date: date, 
        }
    });
    schedules = [...runningTasksScheules, ...stoppedTasksScheules];
    initTaskCalender(schedules);
    createTaskList(date);
}

// 获取任务列表
function loadTaskLists(notifyDevice) {
    allTaskList = [];
    originalTaskList = [];
    const queryData = { path: '', comID: comID };
    fetch(`${protocol}//${hostname}:${port}/taskList`, {
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
            if (data && data.length) {
                originalTaskList = data.map((task) => task);
                allTaskList = data.map((task) => {
                    const taskObj = { ...task };
                    taskObj.repeat = task.repeat || 0;
                    taskObj.repeatName = handleTaskRepeatType(task);
                    taskObj.taskStartDate = task.start_date ? task.start_date.split(' ')[0] : '';
                    taskObj.taskEndDate = task.end_date ? task.end_date.split(' ')[0] : '2099-12-31';
                    taskObj.datesArray = handleTaskDatesArray(taskObj);
                    return taskObj;
                });
                renderTaskCalenderAndTaskList(allTaskList, selectedDate);
                if (notifyDevice) {
                    controlDevice("taskStatGet");
                }
            }
        }).catch(error => {
            console.error('Error:', error);
        });
}

// 初始化日历
function initTaskCalender(schedules) {
    // 初始化日历
    $('.taskCalendar').pignoseCalendar({
        lang: 'ch',
        date: moment(selectedDate),
        scheduleOptions: {
            colors: {
            offer: '#67c23a',
            ad: '#f56c6c'
            }
        },
        schedules: schedules,
        page: function(info, context) {
            setTimeout(() => {
                highlightTodayOnCalendar();
            }, 0);
        },
        select: function(dates, context) {
            if (dates[0]) {
                isListAllTask = false;
                selectedDate = moment(dates[0]).format('YYYY-MM-DD');
                $('#taskDateTitle').html(selectedDate);
                $('#allTasksToggleBtn').html(`<i class="fa-solid fa-list"></i> 全部`);
                createTaskList(selectedDate);
            } else {
                isListAllTask = true;
                $('#taskDateTitle').html("全部日程");
                $('#allTasksToggleBtn').html(`<i class="fa-solid fa-list"></i> 当天`);
                createTaskList();
            }
            highlightTodayOnCalendar();
        },
        click: function(event, context) {
            const $this = $(this);
            event.preventDefault();
            const $element = context.element;
            const $calendar = context.calendar;
            console.log(context);
        }
    });
}

// 生成任务reapeatName
function handleTaskRepeatType(task) {
    if (task.repeat === 0) {
        return '单次';
    } else if (task.repeat === 1) {
        return '日重复';
    } else if (task.repeat === 2) {
        return '周重复';
    } else if (task.repeat === 3) {
        return '月重复';
    } else if (task.repeat === 4) {
        return '年重复';
    }
    return '单次';
}

// 生成符合任务的dateArray
function handleTaskDatesArray(task) {
    const startDate = new Date(task.taskStartDate);
    const endDate = new Date("2099-12-31");
    // const endDate = new Date(task.taskEndDate);
    const datesArray = [];

    if (task.repeat === 0) {
        datesArray.push(task.taskStartDate);
    } else if (task.repeat === 1) {
        // 日重复
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            datesArray.push(d.toISOString().split('T')[0]);
        }
    } else if (task.repeat === 2) {
        // 周重复
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            // 获取当前日期的星期
            let dayOfWeek = d.getDay(); // 0是星期日，1是星期一，依此类推
            if (dayOfWeek === 0) {
                dayOfWeek = 7;
            }
            if (task.wday.split(',').includes(String(dayOfWeek))) {
                datesArray.push(d.toISOString().split('T')[0]);
            }
        }
    } else if (task.repeat === 3) {
        // 月重复
        let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            const checkDate = new Date(formattedDate);
            if (checkDate.getDate() === startDate.getDate()) {
                datesArray.push(formattedDate);
            }
            currentDate.setMonth(currentDate.getMonth() + 1);
        }
    } else if (task.repeat === 4) {
        // 年重复
        let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        while (currentDate <= endDate) {
            const year = currentDate.getFullYear();
            const month = String(startDate.getMonth() + 1).padStart(2, '0');
            const day = String(startDate.getDate()).padStart(2, '0');
            const formattedDate = `${year}-${month}-${day}`;
            const checkDate = new Date(formattedDate);
            if (checkDate.getDate() === startDate.getDate() && checkDate <= endDate) {
                datesArray.push(formattedDate);
            }
            currentDate.setFullYear(currentDate.getFullYear() + 1);
        }
    }
    return datesArray;
}

// 点击全部/当天按钮时，切换任务列表
function onClickAllTasksToggleBtn() {
    if (isListAllTask) {
        isListAllTask = false;
        $('#taskDateTitle').html(selectedDate);
        $('#allTasksToggleBtn').html(`<i class="fa-solid fa-list"></i> 全部`);
        $('.taskCalendar').pignoseCalendar('set', selectedDate);
        createTaskList(selectedDate);
    } else {
        isListAllTask = true;
        $('#taskDateTitle').html("全部日程");
        $('#allTasksToggleBtn').html(`<i class="fa-solid fa-list"></i> 当天`);
        $('.pignose-calendar-unit-date').each(function() {
            $(this).removeClass('pignose-calendar-unit-active');
            $(this).removeClass('pignose-calendar-unit-first-active');
        });
        createTaskList();
    }
}

// 高亮当前日历中的今天
function highlightTodayOnCalendar() {
    // 获取当前日期
    const currentDate = moment().format('YYYY-MM-DD');

    // 遍历所有具有特定类名的元素
    $('.pignose-calendar-unit-date').each(function() {
        const dataDate = $(this).attr('data-date');
        const classes = $(this).attr('class').split(' ');

        // 检查类中是否包含 pignose-calendar-unit-active 或 pignose-calendar-unit-first-active
        if (dataDate === currentDate) {
            if (
                !classes.includes('pignose-calendar-unit-active') && 
                !classes.includes('pignose-calendar-unit-first-active')
            ) {
                // 修改 <a> 标签的 style.color 样式
                $(this).find('a').css('color', '#f56c6c');
            } else {
                $(this).find('a').css('color', '#ffffff');
            }
        }
    });
}

// 创建任务列表项
function createTaskList(date) {
    $(`#taskContentList`).empty();
    setTaskDateBadgeValue(0);
    let taskList = [];
    if (date) {
        taskList = allTaskList.filter((task)=>task.datesArray.includes(date));
    } else {
        taskList = allTaskList.map((task) => task);
    }
    taskList.sort((a, b) => {
        // 使用 Moment.js 解析时间部分
        const timeA = moment(a.start_date, 'YYYY-MM-DD HH:mm:ss').format('HH:mm:ss');
        const timeB = moment(b.start_date, 'YYYY-MM-DD HH:mm:ss').format('HH:mm:ss');

        // 比较时间部分
        if (timeA < timeB) return -1;
        if (timeA > timeB) return 1;
        return 0;
    }).forEach(function(task) {
        createTaskItem(task);
    });
    setTaskDateBadgeValue(taskList.length);
}

// 创建任务列表项
function createTaskItem(task) {
    const taskSwitch = !task.manual_only ? 
        `
            <label class="switch">
                <input class="switchCheckbox" type="checkbox" checked  data-uuid="${task.uuid}" onchange="enableOrDisableTask(this)" />
                <span class="switchSlider"></span>
            </label>
        ` : 
        `
            <label class="switch">
                <input class="switchCheckbox" type="checkbox"  data-uuid="${task.uuid}" onchange="enableOrDisableTask(this)" />
                <span class="switchSlider"></span>
            </label>
        `;
    const playBtnBox = task.running ? 
        `<i class="fa-solid fa-circle-stop" style="color: #f56c6c;" data-uuid="${task.uuid}" onclick="stopTask(this)"></i>` : 
        `<i class="fa-solid fa-circle-play" style="color: #D5B898;" data-uuid="${task.uuid}" onclick="playTask(this)"></i>`;
    const btnGroup = task.running ? 
        `
            <div class="runningTaskIndicatorContainer">
                <image src="/images/icon_runningTask.gif" />
            </div>
        ` : 
        `
            <div class="dropdown" style="float: right; top: 5px;">
                <button class="btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="color: dimgray;">
                    <i class="fa-solid fa-ellipsis"></i>
                </button>
                <ul class="dropdown-menu">
                    <li style="display: none">
                        <a class="dropdown-item" data-uuid="${task.uuid}" onclick="syncTask(this)">
                            <i class="fa-solid fa-rotate" style="width: 16px;"></i> 同步
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" data-uuid="${task.uuid}" onclick="editTask(this)">
                            <i class="fa-solid fa-pencil-alt" style="width: 16px;"></i> 编辑
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" data-uuid="${task.uuid}" onclick="copyTask(this)">
                            <i class="fa-solid fa-copy" style="width: 16px;"></i> 复制
                        </a>
                    </li>
                    <li>
                        <a class="dropdown-item" data-uuid="${task.uuid}" onclick="deleteTask(this)">
                            <i class="fa-solid fa-trash-can" style="width: 16px;"></i> 删除
                        </a>
                    </li>
                </ul>
            </div>
        `;
    const $taskItem = $(`
        <div class="taskItem ${task.running ? 'activeTask' : ''}">
            <div style="display: flex; align-items: center;">
                <div class="taskTime">${task.start_date ? task.start_date.split(" ")[1].match(/^\d{2}:\d{2}/)[0] : ''}</div>
                    <div class="line" style="margin: 0px 50px;"></div>
                    <div>
                        <div title="${task.name}" class="textEllipsis taskName">${task.name}</div>
                        <div title="${task.repeatName}" class="textEllipsis" style="height: 27px; color: rgb(174, 186, 194); font-size: 12px;">
                            <i class="fa-solid fa-location-dot" style="margin-right: 3px;"></i>
                            ${task.repeatName}
                        </div>
                    </div>
                </div>
                <div style="min-width: 140px;">
                    <div style="display: inline-block; line-height: 35px;">
                        ${taskSwitch}
                    </div>
                    <div class="playBtnBox">
                        ${playBtnBox}
                    </div>
                    <div style="display: inline-block;">
                        ${btnGroup}
                    </div>
                </div>
            </div>
        </div>
    `);
    
    $(`#taskContentList`).append($taskItem);
} 

// 给设备发控制指令
function controlDevice(controlType, task, callback) {
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
        fetch(`${protocol}//${hostname}:${port}/controlDevice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": getCookie('session'),
            },
            body: JSON.stringify(queryData)
        });
    } else {
        const out_channel_array = task.out_channel.split(",");
        const out_channel_unique_array = [...new Set(out_channel_array.map((item) => item.split('_')[0]))];
        let data = {
            channelID: comID,
            host: hostname,
            comID: comID,
            controlType: controlType,
            uuid: task.uuid,
            username: userInfo.credentials.identity,
            task: {...task},
            deviceInfo: {},
        };
        delete data.task.running;
        if (controlType === 'play') {
            //手动启动任务时，开始时间+3秒
            const originalStarTime = moment();
            const newStartTime = originalStarTime.add(3, 'seconds');
            data.task.start_date = newStartTime.format("YYYY-MM-DD HH:mm:ss");
        }
        async function processRequests() {
            try {
                const promises = out_channel_unique_array.map(async (thingIdentity) => {
                    const url = `${protocol}//${hostname}:${port}/controlDevice`;
                    const queryData = {...data, thingIdentity: thingIdentity};
                    const response = await fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify(queryData),
                    });
                    return await response.json();
                });
                // 等待所有 Promise 完成（无论成功与否）
                const results = await Promise.allSettled(promises);
                // 处理所有的结果
                results.forEach((result) => {
                    if (result.status === 'fulfilled') {
                        // console.log('成功:', result.value);
                    } else if (result.status === 'rejected') {
                        console.error('失败:', result.reason);
                    }
                });

                if (callback && typeof callback === 'function') {
                    callback();
                }
            } catch (error) {
                // 捕获意外错误（理论上不会走到这里，因为所有的 Promise 都已经处理）
                console.error("意外错误:", error);
            }
        }

        // 调用异步函数
        processRequests();
    }
}

// 发送HTTP请求，添加日程任务
function httpAddTask(query, callback) {
    const queryData = { path: '', comID: comID, task: query };
    fetch(`${protocol}//${hostname}:${port}/addTask`, {
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
            if (callback && typeof callback === 'function') {
                callback();
            }
            if (data.task && data.task.uuid) {
                controlDevice('taskAdd', data.task);
            }
        }).catch(error => {
            console.error('Error:', error);
        });
}

// 发送HTTP请求，更新日程任务
function httpUpdateTask(query, notifyDevice, callback) {
    const queryData = { path: '', comID: comID, task: query };
    fetch(`${protocol}//${hostname}:${port}/updateTask`, {
        method: 'PUT',
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
        if (callback && typeof callback === 'function') {
            callback();
        }
        if (data.task && data.task.uuid && notifyDevice) {
            controlDevice('taskEdit', data.task);
        }
    }).catch(error => {
        console.error('Error:', error);
    });
}

// 启用、禁用任务
function enableOrDisableTask(element) {
    const taskUUID = $(element).attr('data-uuid');
    const task = originalTaskList.find(task => task.uuid === taskUUID);
    let queryData = {...task}
    if ($(element).is(':checked')) {
        queryData.manual_only = false;
    } else {
        queryData.manual_only = true;
    }
    httpUpdateTask(queryData, true, loadTaskLists(true));
}

// 播放任务
function playTask(element) {
    const taskUUID = $(element).attr('data-uuid');
    const task = originalTaskList.find(task => task.uuid === taskUUID);
    controlDevice('taskStart', task);
}

// 停止任务
function stopTask(element) {
    const taskUUID = $(element).attr('data-uuid');
    const task = originalTaskList.find(task => task.uuid === taskUUID);
    controlDevice('taskStop', task);
}

// 同步任务
function syncTask(element) {
    syncStatusTableList = [];
    const taskUUID = $(element).attr('data-uuid');
    const task = originalTaskList.find(task => task.uuid === taskUUID);
    
    const callback = () => {
        // 从out_channel中获取identity并去重
        const out_channel_array = task.out_channel ? 
            Array.from(new Set(task.out_channel.split(',').map(channel => channel.split('_')[0])))
            : [];
        syncStatusTableList = allThingsList.filter((thing) => out_channel_array.includes(thing.credentials.identity))
        $syncTaskTable.bootstrapTable({
            data: syncStatusTableList,
        });
        syncTaskModal.show();
    }

    controlDevice("taskSyncStatusGet", task, callback);

    // 点击一键同步按钮
    $('#oneClickSyncTaskBtn').on('click', () => {
        syncTaskModal.hide();
        showAlert('success', '同步成功！');
    });
}

// 同步任务表格格式化-设备名称
function deviceNameTableFormatter(value, row, index) {
    const deviceIcon = getDeviceIcon(row);
    return `<div class="truncate-text" style="max-width: 250px;" title="${row.name}">
                <img
                    loading="lazy"
                    src="/images/${deviceIcon}" 
                    style="
                        width: 28px; 
                        height:28px; 
                        margin-bottom: 3px;
                    "
                />
                <span>${row.name}</span>
            </div>`;
}

// 同步状态表格格式化-同步状态
function syncStatusTableFormatter(value, row, index) {
    let syncStatusName = '未知状态', color = '#e6a23c';
    if (row.syncStatus === 0) {
        syncStatusName = '同步完成';
        color = '#67c23a';
    } else if (row.syncStatus === 1) {
        syncStatusName = '正在同步';
        color = '#f56c6c';
    } else if (row.syncStatus === 2) {
        syncStatusName = '同步失败';
        color = '';
    }
    return `<div style="color: ${color}">${syncStatusName}</div>`;
}

// 复制任务
function copyTask(element) {
    const taskUUID = $(element).attr('data-uuid');
    const task = originalTaskList.find(task => task.uuid === taskUUID);
    const queryData = { path: '', comID: comID, task: task };
    fetch(`${protocol}//${hostname}:${port}/copyTask`, {
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
            showAlert('success', '复制成功！');
            loadTaskLists(true);
            if (data.task && data.task.uuid) {
                controlDevice('taskAdd', task);
            }
        }).catch(error => {
            console.error('Error:', error);
        });
}

// 编辑任务
function editTask(element) {
    initAddTaskModal();

    const taskUUID = $(element).attr('data-uuid');
    const task = originalTaskList.find(task => task.uuid === taskUUID);
    $('#taskModalConfirmBtn').attr('data-uuid', taskUUID);
    $('#taskModalLabel').html('编辑日程');
    taskModalType = 'edit';

    // 任务名称
    $('#taskName').val(task.name);
    // 任务开始时间
    $('#startTime').val(task.start_date);
    // 任务结束时间
    $('#endTime').val(task.end_date || task.start_date);

    // 播放周期
    if (task.repeat === 0) {
        // 单次
        $('#playbackCycle').val('once');
    } else if (task.repeat === 1) {
        // 日重复
        $('#playbackCycle').val('day');
    } else if (task.repeat === 2) {
        // 周重复
        $('#playbackCycle').val('week');
        $('#weekCheckboxGroup').show();
        const weekArray = task.wday ? task.wday.split(',') : [];
        for (let i = 1; i <= 7; i++) {
            $(`#weekCheckbox${i}`).prop('checked', false);
            if (weekArray.includes(String(i))) {
                $(`#weekCheckbox${i}`).prop('checked', true);
            }
        }
    } else if (task.repeat === 3) {
        // 月重复
        $('#playbackCycle').val('month');
    } else if (task.repeat === 4) {
        // 年重复
        $('#playbackCycle').val('year');
    } else {
        // 单次
        $('#playbackCycle').val('once');
    }

    // 将字符串按逗号分割成数组
    const ossArray = task.songs ? task.songs.split(',') : [];
    // 处理每个元素，生成需要的对象格式
    const resultArray = ossArray.map(item => {
        // 去掉开头的 "oss://"
        const key = item.replace("oss://", "");
        // 提取文件名
        const fileName = key.substring(key.lastIndexOf('/') + 1);
        return { fileName, key: `${comID}/${key}` };
    });
    //播放文件
    selectedSourceObject.files = resultArray.map(item => item);
    if (
        selectedSourceObject.files && selectedSourceObject.files.length && 
        selectedSourceObject.devices && selectedSourceObject.devices.length
    ) {
        $('#sourceName').val('文件 + 采播');
    } else {
        if (
            selectedSourceObject.files && 
            selectedSourceObject.files.length
        ) {
            $('#sourceName').val('文件');
            $('#backgroundSource').append($(`<option value="file">文件</option>`));
            $('#backgroundSource').val('file');
        } else if (
            selectedSourceObject.devices && 
            selectedSourceObject.devices.length
        ) {
            $('#sourceName').val('采播');
        }
    }

    // 播放范围
    const out_channel_array = task.out_channel ? task.out_channel.split(',').map((channel)=>{
        if(channel.includes('_1')){
            return channel.split('_')[0];
        } else {
            return channel;
        }
    }) : [];
    selectedPlayAreas = allThingsList.filter(thing => out_channel_array.includes(thing.credentials.identity));
    createPlayAreasList();
    
    // 重复次数
    $('#endTime').prop('disabled', true);
    $('#repeatNum').val(task.cyclic_times)
    $('#repeatNumSwitch').prop('checked', true);
    $('#endTimeContainer').hide();
    if (task.duration) {
        $('#repeatNumSwitch').prop('checked', false);
        $('#endTimeContainer').show();
    }

    // 随机播放
    $('#randomPlay').prop('checked', false);
    if (task.song_play_type === 1) {
        $('#randomPlay').prop('checked', true);
    }

    // 音量微调
    $('#volumeControl').val(task.master_volume);
    $('#volumeLabel').html(task.master_volume);
    
    // 优先级
    for (let i = 1; i <= 3; i++) {
        $(`#level${i}`).prop('checked', false);
        if (task.priority === i) {
            $(`#level${i}`).prop('checked', true);
        }
    }

    taskModal.show();
}

// 删除任务
function deleteTask(element) {
    const taskUUID = $(element).attr('data-uuid');
    showConfirmModal("确定要删除所选数据吗？", () => {
        const queryData = { path: '', comID: comID, uuid: taskUUID };
        fetch(`${protocol}//${hostname}:${port}/deleteTask`, {
            method: 'DELETE',
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
                showAlert('success', '删除成功！');
                loadTaskLists(true);
                if (data.task && data.task.uuid) {
                    controlDevice('taskDelete', task);
                }
            }).catch(error => {
                console.error('Error:', error);
            });
    });
}

// 更新任务数量
function updateDisplay() {
    if (taskDateBadgeCurrentValue !== taskDateBadgeTargetValue) {
        taskDateBadgeCurrentValue += taskDateBadgeIncrement;
        $(`#taskDateBadge`).html(taskDateBadgeCurrentValue);
        requestAnimationFrame(updateDisplay);
    }
}

// 生成播放区域列表-任务弹框
function createPlayAreasList(){
    $('#playAreaListsContainer').empty();
    if (selectedPlayAreas.length) {
        const limit = selectedPlayAreas.length >= 4 ? 4 : selectedPlayAreas.length;
        for (let i = 0; i < limit; i++) {
            const $playArea = $(`
                <div class="d-grid col-6" title="${selectedPlayAreas[i].metadata.aliase}">
                    <button disabled type="button" class="btn btn-light truncate-text" style="color: #20afbf;">
                        <img loading="lazy" src="/images/icon_channel.png" class="channel-icon" />
                        <span>${selectedPlayAreas[i].metadata.aliase}</span>
                    </button>
                </div>
            `);
            $('#playAreaListsContainer').append($playArea);
        }
    }
}

// 关闭添加播放区域弹框-添加播放区域弹框
function closePlayAreasAddModal() {
    playAreasAddModal.hide();
    if (addPlayAreaModalIsOpenedFromDetailModal) {
        playAreasDetailModal.show();
        createPlayAreasDetailList();
    } else {
        taskModal.show();
    }
    createPlayAreasList();
    if (selectedPlayAreas && selectedPlayAreas.length) {
        $('#playAreaError').hide();
        $('#playAreaError').empty();
    } else {
        $('#playAreaError').html(requiredMsg);
        $('#playAreaError').show();
    }
}

// 获取组装播放区域设备树-播放区域弹框
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
                            };
                            playAreaTreeData[0].children[0].children.push(thingNode);
                        });
                    }
                    $playAreaTree = $('#playAreaTree').tree({
                        primaryKey: 'key',
                        uiLibrary: 'bootstrap5',
                        dataSource: playAreaTreeData,
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

// 打开添加播放区域弹框-播放区域详情弹框
function openPlayAreasAddModalFromDetailModal() {
    addPlayAreaModalIsOpenedFromDetailModal = true;
    playAreasDetailModal.hide();
    playAreasAddModal.show();
}

// 生成播放区域详情列表-播放区域详情弹框
function createPlayAreasDetailList() {
    $('#playAreasDetailListContainer').empty();
    const $addPlayAreaCard = $(`
        <div class="d-grid col-4" title="添加" style="cursor: pointer;">
            <div class="hoverCard card" style="height:95px;" onclick="openPlayAreasAddModalFromDetailModal()">
                <div class="card-body" style="text-align: center;">
                    <i class="fa-solid fa-plus" style="font-size: 32px; color: #20afbf;"></i>
                    <div class="truncate-text" style="font-size: 14px; width: 100%;">
                        添加
                    </div>
                </div>
            </div>
        </div>
    `);

    if (selectedPlayAreas.length) {
        const limit = selectedPlayAreas.length;
        for (let i = 0; i < limit; i++) {
            const $playAreaDetailItem = $(`
                <div class="d-grid col-4" title="${selectedPlayAreas[i].metadata.aliase}">
                    <div class="hoverCard card" style="height:95px;">
                        <div class="card-body" style="text-align: center;">
                            <img loading="lazy" src="/images/icon_channel.png" style="margin-bottom: 5px; width: 32px;" />
                            <div class="truncate-text" style="font-size: 14px; width: 100%;">
                                ${selectedPlayAreas[i].metadata.aliase}
                            </div>
                        </div>
                    </div>
                </div>
            `);
            $('#playAreasDetailListContainer').append($playAreaDetailItem);
        }
        $('#playAreasDetailListContainer').append($addPlayAreaCard);
    } else {
        $('#playAreasDetailListContainer').append($addPlayAreaCard);
    }
}

// 设置任务数量
function setTaskDateBadgeValue(newValue) {
    taskDateBadgeTargetValue = newValue;
    taskDateBadgeIncrement = (taskDateBadgeTargetValue > taskDateBadgeCurrentValue) ? 1 : -1;
    requestAnimationFrame(updateDisplay);
}

// 初始化添加任务模态框表单
function initAddTaskModal () {
    taskModalType = 'add';
    selectedFilesModal = [];
    $('#taskModalLabel').html('新建日程');

    $('#taskName').val('');
    $('#taskNameError').hide();

    $('#sourceName').val('');
    $('#sourceNameError').hide();

    $('#startTime').val('');
    $('#startTimeError').hide();

    $('#endTimeContainer').hide();
    $('#endTime').val('');
    $('#endTimeError').hide();
    $('#endTime').attr("disabled", false);

    $('#playbackCycle').val('0');
    $('#playbackCycleError').hide();

    $('#weekCheckboxGroup').hide();
    $('.taskWeekCheckbox').prop('checked', false);

    selectedPlayAreas = [];
    $('#playAreaError').empty();
    $('#playAreaError').hide();

    showMoreSettingTaskModal = false;
    $('#moreSettingBtnTaskModal').empty();
    $('#moreSettingBtnTaskModal').append($(`<i class="fa-solid fa-chevron-down"></i>`));
    $('#moreSettingContainerTaskModal').hide();
    
    $('#randomPlay').prop('checked', false);

    $('#volumeControl').val('0');
    $('#volumeLabel').html(0);

    $('#level1').prop('checked', false);
    $('#level2').prop('checked', true);
    $('#level3').prop('checked', false);

    // 音源选择弹框相关
    showMoreSettingSourceModal = false;
    $('#moreSettingBtnSourceModal').empty();
    $('#moreSettingBtnSourceModal').append($(`<i class="fa-solid fa-chevron-down"></i>`));
    $('#moreSettingContainerSourceModal').hide();

    $('#backgroundSource').empty();
    $('#backgroundSource').append($(`<option value="0" selected>无</option>`));
    $('#backgroundSource').val('0');
    selectedSourceObject = {
        files:[],
        devices: [],
    };
    
    $('#sourceModalFileListContainer').empty();
    $('#sourceModalDeviceListContainer').empty();

    $('#repeatNum').val(1)
    $('#repeatNumSwitch').prop('checked', true);

    $('#taskModalConfirmBtn').attr('data-uuid', "");
}

// 生成音源文件列表-音源弹框
function createSourceModalFileList() {
    $('#sourceModalFileListContainer').empty();
    if (selectedSourceObject.files && selectedSourceObject.files.length) {
        selectedSourceObject.files.forEach((file, index) => {
            const $fileItem = $(`
                <li class="list-group-item sourceModalListItem">
                    <div>
                        <span>${file.fileName}</span>
                    </div>
                    <div>
                        <span
                            title="复制"
                            style="margin-right: 10px; color: #20afbf; cursor: pointer;"
                            onclick="copyFileForSourceModal('${file.key}')"
                        >
                            <i class="fa-solid fa-copy"></i>
                        </span>
                        <span
                            title="移除"
                            style="color: #20afbf; cursor: pointer;"
                            onclick="removeFileForSourceModal('${file.key}', '${index}')"
                        >
                            <i class="fa-solid fa-trash-can"></i>
                        </span>
                    </div>
                </li>
            `);
            $('#sourceModalFileListContainer').append($fileItem);
        });
    }
    updateBackgroundSourceOptions();
}

// 音源文件列表中复制文件-音源弹框
function copyFileForSourceModal(key) {
    const targetFile = selectedSourceObject.files.find(file => String(file.key) === key);
    const targetIndex = selectedSourceObject.files.findIndex(file => String(file.key) === key);
    if (targetIndex !== -1) {
        selectedSourceObject.files.splice(targetIndex, 0, targetFile);
        createSourceModalFileList();
    }
}

// 音源文件列表中移除文件-音源弹框
function removeFileForSourceModal(key, index) {
    selectedSourceObject.files.splice(index, 1);
    createSourceModalFileList();
}

// 生成音源设备列表-音源弹框
function createSourceModalDeviceList() {
    $('#sourceModalDeviceListContainer').empty();
    if (selectedSourceObject.devices && selectedSourceObject.devices.length) {
        selectedSourceObject.devices.forEach((device, index) => {
            const $deviceItem = $(`
                <li class="list-group-item sourceModalListItem">
                    <div>
                        <img loading="lazy" src="/images/icon_channel.png" class="channel-icon" />
                        <span>${device.name}</span>
                    </div>
                    <div>
                        <span
                            title="移除"
                            style="color: #20afbf; cursor: pointer;"
                            onclick="removeDeviceForSourceModal('${device.key}', '${index}')"
                        >
                            <i class="fa-solid fa-trash-can"></i>
                        </span>
                    </div>
                </li>
            `);
            $('#sourceModalDeviceListContainer').append($deviceItem);
        });
    }
    updateBackgroundSourceOptions();
}

// 音源设备列表中移除设备-音源弹框
function removeDeviceForSourceModal(key, index) {
    selectedSourceObject.devices.splice(index, 1);
    createSourceModalDeviceList();
}

// 更新音源选择弹框中背景音下拉框的选项-音源弹框
function updateBackgroundSourceOptions() {
    $('#backgroundSource').empty();
    $('#backgroundSource').append($(`<option value="0">无</option>`));
    if (selectedSourceObject.files.length) {
        $('#backgroundSource').append($(`<option value="file">文件</option>`));
    }
    if (selectedSourceObject.devices.length) {
        selectedSourceObject.devices.forEach(device => {
            $('#backgroundSource').append($(`<option value="${device.id}">${device.name}</option>`));
        });
    }
}

// 音源设备表格设备名称-设备弹框
function inputChannelNameTableFormatter(value, row, index) {
    return `<div>
                <img loading="lazy" src="/images/icon_channel.png" style="width: 16px; margin-bottom: 3px;" />
                <span data-key="${row.key}" data-devicename="${row.deviceName}">${value}</span>
            </div>`;
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
            if(selectedSourceObject.files && selectedSourceObject.files.length) {
                const selectKeys = selectedSourceObject.files.map(file => file.key);
                $filesModalTable.bootstrapTable('checkBy', {field: 'key', values: selectKeys});
            }
        }).catch(error => {
            console.error('Error:', error);
        });
}

// 禁用文件夹勾选框-文件弹框
function fileNameTableStateFormatter(value, row, index) {
    if (row.isDir) {
        return {
            disabled: true
        }
    }
    return value
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