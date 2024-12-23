let currentDevices = {}, 
    newDevices = {}, 
    connectThingsModalList = [],  //关联设备弹框列表
    selectedThingsIds = []; //关联设备弹框选中id

$(document).ready(function() {
    const currentUrl = window.location.href; // 获取当前页面的URL
    const urlObj = new URL(currentUrl);
    const onlineStatusValue = (currentUrl.match(/onlineStatus=(\d+)/) || [])[1] || sessionStorage.getItem("onlineStatus") || '1'; // 从URL获取onlineStatus的值
    sessionStorage.setItem("onlineStatus", onlineStatusValue);
    getThingsList(onlineStatusValue, false);

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

    $('input[name="btnOnlineStatus"]').change(function() {
        let reqOnlineStatus = '2'; //all
        if (this.id === 'btnOnline') {
            reqOnlineStatus = '1'; //online
        } else if (this.id === 'btnOffline') {
            reqOnlineStatus = '0'; //offline
        }
        sessionStorage.setItem("onlineStatus", reqOnlineStatus);
        // 获取当前页面的完整URL
        const currentUrl = window.location.href;
        // 创建URL对象
        const urlObj = new URL(currentUrl);
        window.location.href = `${urlObj.pathname}?page=1&limit=1000&onlineStatus=${reqOnlineStatus}`;
        stopPollingChannelThings();
        getThingsList(reqOnlineStatus);
    });

    $('#connect-things-btn').click(function() {
        const channelID = "{{.ChannelID}}";
        if (selectedThingsIds.length) {
            // 延迟函数，返回一个在指定毫秒后解决的 Promise
            function delay(ms) {
                return new Promise(resolve => setTimeout(resolve, ms));
            }

            async function processRequests() {
                try {
                    for (const thingID of selectedThingsIds) {
                        const url = `/ui/channels/connect?channelID=${channelID}&thingID=${thingID}`;
                        const query = {thing_ids: selectedThingsIds}
                        try {
                            const response = await fetch(url, {
                                method: "POST",
                            });
                            const result = await response.json();
                            console.log('成功:', result);
                        } catch (error) {
                            console.error('失败:', error);
                        }
                        
                        // 每个请求之间等待10毫秒
                        await delay(100);
                    }
                    // 所有请求都完成后，刷新页面
                    window.location.reload();
                } catch (error) {
                    // 捕获意外错误（理论上不会走到这里，因为所有的 Promise 都已经处理）
                    console.error("意外错误:", error);
                    window.location.reload();
                }
            }

            // 调用异步函数
            processRequests();
        } else {
            showAlert("info", "请选择要添加的设备");
        }
    });
});

// 启动轮询
function startPollingChannelThings() {
    return setInterval(refreshThingsData, 2000); // 每5秒轮询一次
}

// 清理并重启轮询
function resetPollingChannelThings(intervalId) {
    clearInterval(intervalId);
    return startPollingChannelThings();
}

// 停止轮询
function stopPollingChannelThings() {
    if (pollingIntervalIdChannelThings) {
        clearInterval(pollingIntervalIdChannelThings);
        pollingIntervalIdChannelThings = null;
    }
}

// 初始启动轮询
let pollingIntervalIdChannelThings = null;

// 每10分钟清理并重启轮询
let resetPollingChannelThingsInterval = setInterval(function() {
    pollingIntervalIdChannelThings = resetPollingChannelThings(pollingIntervalIdChannelThings);
}, 10 * 60 * 1000); // 10分钟

// 在组件卸载时停止调用
window.addEventListener('beforeunload', ()=>{
    stopPollingChannelThings();
    clearInterval(resetPollingChannelThingsInterval);
    resetPollingChannelThingsInterval = null;
});

document.addEventListener('visibilitychange', () => {
    console.log('visibilitychange channelThings: ', document.visibilityState);
    if (document.visibilityState === 'hidden') {
        stopPollingChannelThings();
    } else {
        pollingIntervalIdChannelThings = startPollingChannelThings();
    }
});

//关联设备弹框设备列表-勾选设备
function onSelectNewThing(e) {
    e.stopPropagation();
    const checkbox = e.target;
    const isChecked = checkbox.checked;
    const value = e.target.value;
    //判断是否全选，全反选
    if (value === 'selectAll') {
        if (isChecked) {
            selectedThingsIds = connectThingsModalList.map((item)=>{
            return item.id;
        });
            connectThingsModalList.forEach((item)=>{
            $(`#checkbox_${item.id}`).prop("checked", true);
        });
        } else {
            selectedThingsIds = [];
            connectThingsModalList.forEach((item)=>{
                $(`#checkbox_${item.id}`).prop("checked", false);
            });
        }
    } else {
        if (isChecked) {
            if (!selectedThingsIds.includes(value)) {
                selectedThingsIds.push(value);
            }
        } else {
            selectedThingsIds = selectedThingsIds.filter((id)=> id !== value)
        }
    }

    if (selectedThingsIds.length) {
        $("#connect-things-btn").removeAttr("disabled");
        //判断全选框是否半勾选
        if (selectedThingsIds.length === connectThingsModalList.length) {
            $(`#checkbox_selectAll`).prop("checked", true);
            $(`#checkbox_selectAll`).prop("indeterminate", false);
        } else {
            $(`#checkbox_selectAll`).prop("indeterminate", true);
            $(`#checkbox_selectAll`).prop("checked", false);
        }
    } else {
        $("#connect-things-btn").attr("disabled", true);
        $(`#checkbox_selectAll`).prop("indeterminate", false);
        $(`#checkbox_selectAll`).prop("checked", false);
    }
}

//打开关联设备弹框
function openConnectThingModal() {
    const thingModal = new bootstrap.Modal(document.getElementById("connectThingModal"));
    thingModal.show();

    connectThingsModalList = [], selectedThingsIds = [];

    fetch(`/ui/entities?item=things&limit=${1000}&page=1`,{ method: "GET" })
        .then((response) => response.json())
        .then((data) => {
            connectThingsModalList = data.data;
            $(`#connectThingsList`).empty();
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
            $(`#connectThingsList`).append($selectAll);

            //设备列表
            connectThingsModalList.forEach((thing, index)=>{
                const thingName = thing.metadata.out_channel_array && thing.metadata.out_channel_array.length > 1 ? 
                    thing.metadata.aliase : thing.name;
                const $thingList = $(`
                    <li class="list-group-item newThingItemList" >
                        <input 
                            class="form-check-input" 
                            type="checkbox" 
                            value="${thing.id}" 
                            id="checkbox_${thing.id}"
                            onchange="onSelectNewThing(event)"
                            name="checkbox_${thing.id}" 
                            ${selectedThingsIds.includes(thing.id) ? `checked` : ``}
                        />
                        <label for="checkbox_${thing.id}" class="form-check-label">
                            <img 
                                loading="lazy"
                                src="/images/icon_channel.png" 
                                style="height: 18px; margin-top: -3px; margin-left: 5px;"
                            />
                            <span 
                                data-bs-toggle="tooltip" 
                                data-bs-placement="bottom" 
                                data-bs-title="${thingName}" 
                                title="${thingName}"
                            >
                                ${thingName}
                            </span>
                        </label>
                    </li>
                `);
                $(`#connectThingsList`).append($thingList);
            })

            $("#connect-things-btn").attr("disabled", true);
            $(`#checkbox_selectAll`).prop("indeterminate", false);
            $(`#checkbox_selectAll`).prop("checked", false);
        })
        .catch((error) => console.error("Error:", error));
}

//重启设备
function rebootThing(thingIdentity) {
    showConfirmModal("确定要重启所选设备吗？", () => {
        conntrolThing(thingIdentity, "deviceReboot");
    });
}

//控制设备
function conntrolThing(thingIdentity, controlType) {
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
                const defaultChannelId = domainData.metadata["comID"];
                if (domainID && defaultChannelId) {
                    postMessage(comID, controlType, thingIdentity);
                }
            })
    } else {
        redirectToLogin();
    }
}

function changeOnlineStatus(thing){
    const onlineStatus = thing.metadata && thing.metadata.is_online === "1";
    if (onlineStatus) {
        $(`#${thing.id}-thingCardContent`).css('background', 'rgba(255, 255, 255, 0.8)');
        // $(`#${thing.id}-rebootBtn`).css('display', 'block');
    } else {
        $(`#${thing.id}-thingCardContent`).css('background', 'rgba(0, 0, 0, 0.1)');
        // $(`#${thing.id}-rebootBtn`).css('display', 'none');
    }
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
    fetch(`${urlObj.pathname}InJSON?page=${page}&limit=${limit}&onlineStatus=${reqOnlineStatus}`, {
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
            // console.error('处理fetch或JSON时出错:', error);
        });
}

function updateThingsGrid(devices) {
    const $thingsGrid = $('#thingsGrid');
    const currentDevicesLength = Object.keys(currentDevices).length;
    const newDevicesLength = Object.keys(newDevices).length;
    const urlObj = new URL(window.location.href);
    const match = urlObj.pathname.match(/\/channels\/([^\/]+)\/things/);
    let channelID = '';
    if (match) {
        channelID = match[1];
    }

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
        })
    } else if (currentDevicesLength < newDevicesLength) {
        // 新增(查询在线时刚上线的，查询离线时刚离线的)的设备]
        Object.keys(newDevices).forEach((newId)=>{
            if (
                (typeof currentDevices === 'object' && Object.entries(currentDevices).length === 0) || 
                (currentDevices[newId] === null || currentDevices[newId] === undefined) ||
                (typeof currentDevices[newId] === 'object' && Object.entries(currentDevices[newId]).length === 0)
            ) {
                const device = newDevices[newId];
                const imgSpan = `<img loading="lazy" id="${device.id}-thingIcon" src="/images/icon_channel.png" class="hoverCardIcon" />`;
                const btnSpan = `
                    <div class="dropdown" style="float: right;">
                        <button class="btn dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <i class="fa-solid fa-ellipsis"></i>
                        </button>
                        <ul class="dropdown-menu">
                            <form action="/ui/channels/${channelID}/things/disconnect?item=channels" method="post">
                                <li>
                                    <input type="hidden" name="thingID" value="${device.id}" />
                                    <button type="submit" class="dropdown-item">
                                        <i class="fa-solid fa-link-slash" style="width: 16px;"></i> 移除设备
                                    </button>
                                </li>
                            </form>
                        </ul>
                    </div>
                `;
                const thingName = device.metadata.out_channel_array && device.metadata.out_channel_array.length > 1 ? 
                    device.metadata.aliase : device.name;
                const $thingCard = $(`
                    <div id="${device.id}-thingCard">
                        <div class="hoverCard card" id="${device.id}-thingCardContent">
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
                                    <h5 
                                        class="card-title truncate-text"
                                        data-bs-toggle="tooltip" 
                                        data-bs-placement="bottom" 
                                        data-bs-title="${thingName}" 
                                        title="${thingName}"
                                    >
                                        ${thingName}
                                    </h5>
                                </div>
                            </div>
                        </div>
                    </div>
                `);
                $(`#thingsGrid`).append($thingCard);
                changeOnlineStatus(device);
            }
        })
    }

    currentDevices = {};
    currentDevices = {...newDevices};
}

//根据在线类型获取设备列表
function getThingsList(onlineStatus, isRender) {
    currentDevices = {}, newDevices = {};
    const urlObj = new URL(window.location.href);
    fetch(`${urlObj.pathname}InJSON?limit=1000&onlineStatus=${onlineStatus}`, {
        method: "GET",
    })
        .then(response => {
            pollingIntervalIdChannelThings = startPollingChannelThings();
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json(); // 直接将流转换为JSON对象
        })
        .then(json => {
            const data = json.data;
            const thingsData = JSON.parse(data).thingsData;
            const things = thingsData.things || [];
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
        .catch(error => {
            //
        });
}

function postMessage(channelID, controlType, thingIdentity) {
    const url = window.location.href; // 获取当前页面的URL
    const address = new URL(url);
    const port =  sessionStorage.getItem("socketBridgePort") || "63001";
    const identity = thingIdentity.split("_")[0];
    const queryData = {
        channelID: channelID,
        thingIdentity: identity,
        host: address.hostname,
        comID: channelID,
        controlType: controlType,
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
            console.log("postMessage: ", response)
        })
        .catch((error) => {
            console.error("error postMessage: ", error);
        });
}