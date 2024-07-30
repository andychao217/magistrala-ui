let ws = null, 
    allThingsListWebsocket = [];

const hostNameWebsocket = getHostnameWebsocket(window.location),
      protocolWebsocket = window.location.protocol,
      portSocketBridge = sessionStorage.getItem("socketBridgePort") || "63001",
      userInfoStrWebsocket = sessionStorage.getItem("userInfo"),
      userInfoWebsocket = JSON.parse(userInfoStrWebsocket);

// 获取当前网页的域名
function getHostnameWebsocket(url) {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
}

// 建立websocket连接
function connectWebSocket(host, port, defaultChannelId) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log("WebSocket is already open.");
        return;
    }
    ws = new WebSocket(`ws://${host}:${port}/websocket`);

    // 监听WebSocket的open事件，连接成功时给后台发一些参数，后台去建立mqtt连接
    ws.onopen = function (event) {
        console.log("WebSocket is open now.");
        const topics = [
            `channels/${defaultChannelId}/messages/common/app`,
            `channels/${defaultChannelId}/messages/common/device`,
            `channels/${defaultChannelId}/messages/web_${defaultChannelId}`
        ];
        const message = { 
            topics: topics, 
            host: hostNameWebsocket, 
            thingSecret: "platform" + defaultChannelId, 
            message: "connect" 
        };
        ws.send(JSON.stringify(message));
    };

    // 监听WebSocket的message事件，后台发来消息时触发
    ws.onmessage = function (event) {// 处理从服务器接收到的数据
        const url = window.location.href, 
              data = JSON.parse(event.data);
        
        // 使用postMessage将消息传递给iframe（如果存在）
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'websocket-message', data: data }, '*');
        }

        if (
            url.indexOf("task") !== -1 || 
            sessionStorage.getItem("curPageUrl").includes("task")
        ) {
            // 当前为日程页面
            handleTaskMessage(data);
        } else if (
            url.indexOf("things") !== -1 || 
            sessionStorage.getItem("curPageUrl").includes("things")
        ) {
            console.log("allThingsListWebsocket: ", allThingsListWebsocket);
            handleThingMessage(data, defaultChannelId);
        }
    };

    ws.onclose = function (event) {
        if (event.wasClean) {
            console.log("WebSocket closed cleanly, code=" + event.code + " reason=" + event.reason);
        } else {
            console.error("WebSocket disconnected unexpectedly (code=" + event.code + " reason=" + event.reason + ")");
        }
        // 可以在这里尝试重新连接
    };

    ws.onerror = function (error) {
        console.error("WebSocket Error: ", error);
        connectWebSocket(host, port, defaultChannelId);
    };
}

function handleTaskMessage(data) {
    if (data.msgName === "TASK_START") {
         // 任务开始
        const task = originalTaskList.find(task => task.uuid === data?.data?.task?.uuid);
        const queryData = {...task};
        if (task && task.uuid) {
            queryData.running = true;
            httpUpdateTask(queryData, false, loadTaskLists(false));
        }
    } else if (data.msgName === "TASK_STOP") {
        // 任务结束
        const task = originalTaskList.find(task => task.uuid === data?.data?.uuid);
        const queryData = {...task};
        if (task && task.uuid) {
            queryData.running = false;
            httpUpdateTask(queryData, false, loadTaskLists(false));
        }
    } else if (data.msgName === "TASK_SYNC_STATUS_GET_REPLY") {
        // 处理任务同步状态响应
    }
}

function handleThingMessage(data, defaultChannelId) {
    // 当前为分区设备、或设备页面
    const deviceName = data.data?.info?.device_name;
    const newDeviceInfo = {...data.data?.info};
    //检查设备信息是否更新，如果更新了，则更新前端数据
    if (data.msgName === "DEVICE_INFO_UPDATE" || data.msgName === "DEVICE_INFO_GET_REPLY") {
        const targetDevice = allThingsListWebsocket.find(device => device.credentials.identity === deviceName);
        if (targetDevice && targetDevice.id) {
            console.log("targetDevice: ", targetDevice);
            const originalDeviceInfo = targetDevice.metadata && targetDevice.metadata["info"] ? targetDevice.metadata["info"] : {};
            const originalDeviceAliase = targetDevice.metadata["aliase"] || "";
            const originalDeviceName = targetDevice.name;
            if (!_.isEqual(originalDeviceInfo, newDeviceInfo) || originalDeviceName !== newDeviceInfo.device_aliase) {
                const queryData = {...targetDevice};
                queryData.metadata["info"] = {...newDeviceInfo};
                queryData.name = newDeviceInfo.device_aliase;
                queryData.metadata["aliase"] = newDeviceInfo.device_aliase + '_' + splitStringByLastUnderscore(originalDeviceAliase)[1];
                httpUpdateThingWebsocket(queryData, defaultChannelId);
            }
       }
    }
}

function httpGetDomainIdWebsocket() {
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
              const port =  sessionStorage.getItem("socketBridgePort") || "63001";
              if (domainID && defaultChannelId) {
                connectWebSocket(hostNameWebsocket, port, defaultChannelId);
                httpGetAllThingsListWebsocket(hostNameWebsocket, defaultChannelId, true);
                setupMessageListener(defaultChannelId);
              }
            })
    }
}

function setupMessageListener(defaultChannelId) {
    window.addEventListener("message", function(event) {
        if (event.data.type === 'websocket-message') {
            const data = event.data.data;
            const url = window.location.href;

            if (
                url.indexOf("task") !== -1 || 
                sessionStorage.getItem("curPageUrl").includes("task")
            ) {
                handleTaskMessage(data);
            } else if (
                url.indexOf("things") !== -1 || 
                sessionStorage.getItem("curPageUrl").includes("things")
            ) {
                handleThingMessage(data, defaultChannelId);
            }
        }
    });
}

// 获取所有设备列表
function httpGetAllThingsListWebsocket(host, comID, notifyDevice) {
    fetch(`/ui/things/thingsInJSON?page=1&limit=1000&onlineStatus=2`, {
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
            allThingsListWebsocket = thingsData && typeof thingsData === 'object' && 
                thingsData.things && typeof thingsData.things === 'object' ?  
                    [...thingsData.things]  : [];
            if (allThingsListWebsocket.length && notifyDevice) {
                const url = window.location.href;
                if (url.indexOf("things") !== -1) {
                    // 进入设备页面时，发送请求获取设备信息
					controlDeviceWebsocket(host, comID, "deviceInfoGet");
                }
            }
        })
        .catch(error => {
            allThingsListWebsocket = [];
        });
}

function controlDeviceWebsocket(host, comID, controlType) {
    const out_channel_unique_array = [...new Set(allThingsListWebsocket.map((item) => item.credentials.identity.split('_')[0]))];
    let queryData = {
        channelID: comID,
        host: host,
        comID: comID,
        controlType: controlType,
        uuid: "",
        username: userInfoWebsocket.credentials.identity,
        task: {},
    };
    async function processRequests() {
        try {
            const promises = out_channel_unique_array.map(async (thingIdentity) => {
                const url = `${protocolWebsocket}//${hostNameWebsocket}:${portSocketBridge}/controlDevice`;
                const data = {...queryData, thingIdentity: thingIdentity};
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(data),
                });
                return await response.json();
            });
            // 等待所有 Promise 完成（无论成功与否）
            const results = await Promise.allSettled(promises);
            // 处理所有的结果
            results.forEach((result) => {
                if (result.status === 'fulfilled') {
                    console.log('成功:', result.value);
                } else if (result.status === 'rejected') {
                    console.error('失败:', result.reason);
                }
            });
        } catch (error) {
            // 捕获意外错误（理论上不会走到这里，因为所有的 Promise 都已经处理）
            console.error("意外错误:", error);
        }
    }

    // 调用异步函数
    processRequests();
}

// 更新设备信息
function httpUpdateThingWebsocket(queryData, comID) {
    fetch(`/ui/things/${queryData.id}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(queryData),
    }).then(response => {
        httpGetAllThingsListWebsocket(hostNameWebsocket, comID, false);
    });
}


$(function () {
    // DOM 加载完成后执行的代码
    if (!containsLoginInUrl()) {
        httpGetDomainIdWebsocket();
    }
});
