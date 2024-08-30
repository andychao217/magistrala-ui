let ws = null, 
    allThingsListWebsocket = [];

const hostNameWebsocket = getHostnameWebsocket(window.location),
      protocolWebsocket = window.location.protocol,
      portSocketBridge = sessionStorage.getItem("socketBridgePort") || "63001",
      userInfoStrWebsocket = sessionStorage.getItem("userInfo"),
      userInfoWebsocket = JSON.parse(userInfoStrWebsocket);

// 防抖动函数
function debounce(func, wait) {
    let timeout;
    return function () {
        const context = this, args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// 包装后的 httpUpdateThingWebsocket 函数
const debouncedHttpUpdateThingWebsocket = debounce(httpUpdateThingWebsocket, 100);

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
        // console.log("WebSocket is open now.");
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
              data = JSON.parse(event.data),
              curPageUrl = sessionStorage.getItem("curPageUrl");
        
        // 使用postMessage将消息传递给iframe（如果存在）
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: 'websocket-message', data: data }, '*');
        }

        if (curPageUrl) {
            if (
                url.indexOf("task") !== -1 || 
                curPageUrl.includes("task")
            ) {
                // 当前为日程页面
                handleTaskMessage(data);
            } else if (
                url.indexOf("things") !== -1 || 
                curPageUrl.includes("things")
            ) {
                // 当前为设备页面
                handleThingMessage(data, defaultChannelId);
            } else if (
                url.indexOf("broadcast") !== -1 || 
                curPageUrl.includes("broadcast")
            ) {
                // 当前为实时广播页面
                handleBroadcastMessage(data);
            }
        }
    };

    ws.onclose = function (event) {
        if (event.wasClean) {
            console.log("WebSocket closed cleanly, code=" + event.code + " reason=" + event.reason);
        } else {
            connectWebSocket(host, port, defaultChannelId);
        }
    };

    ws.onerror = function (error) {
        connectWebSocket(host, port, defaultChannelId);
    };
}

// 处理日程相关message
function handleTaskMessage(data) {
    // 获取 iframe 元素
    const iframe = document.getElementById('iframePage');
    if (data.msgName === "TASK_START") {
        // 任务开始
        const targetUuid = data?.data?.task?.uuid || "";
        if (targetUuid) {
            if (iframe) {
                iframe.contentWindow.handleUpdateTaskRunningStatus(targetUuid, true);
            } else {
                handleUpdateTaskRunningStatus(targetUuid, true);
            }
        }
    } else if (data.msgName === "TASK_STOP") {
        // 任务结束
        const targetUuid = data?.data?.uuid || "";
        if (targetUuid) {
            if (iframe) {
                iframe.contentWindow.handleUpdateTaskRunningStatus(targetUuid, false);
            } else {
                handleUpdateTaskRunningStatus(targetUuid, false);
            }
        }
    } else if (data.msgName === "TASK_SYNC_STATUS_GET_REPLY") {
        // 处理任务同步状态响应
    }
}

// 处理设备相关message
function handleThingMessage(data, defaultChannelId) {
    const iframe = document.getElementById('iframePage');

    // 更新设备信息
    const handleDeviceInfoUpdate = (deviceName, newDeviceInfo) => {
        const targetDevice = allThingsListWebsocket.find(device => device.credentials.identity === deviceName);
        if (targetDevice && targetDevice.id) {
            const originalDeviceInfo = targetDevice.metadata?.info || {};
            const originalDeviceName = targetDevice.name;

            if (!_.isEqual(originalDeviceInfo, newDeviceInfo) || originalDeviceName !== newDeviceInfo.device_aliase) {
                const queryData = {
                    ...targetDevice,
                    metadata: {
                        ...targetDevice.metadata,
                        info: _.cloneDeep(newDeviceInfo),
                        aliase: `${newDeviceInfo.device_aliase}_${newDeviceInfo.out_channel.channel[0].aliase}`,
                        out_channel_array: _.cloneDeep(newDeviceInfo.out_channel.channel),
                        out_channel: `${newDeviceInfo.out_channel.channel.length}` || "0",                      in_channel: newDeviceInfo.in_channel,
                    },
                    name: newDeviceInfo.device_aliase,
                };
                debouncedHttpUpdateThingWebsocket(queryData, defaultChannelId);
            }
        }
    };

    // 处理日志
    const handleLogReply = (logs, logContainer) => {
        logContainer.innerHTML = "";

        if (!logs || logs.length === 0) return;
        
        logs.forEach(log => {
            const p = document.createElement('p');
            p.style.marginBottom = "0.5rem";
            p.textContent = log.message;
            logContainer.appendChild(p);
        });
    };

    if (["DEVICE_INFO_UPDATE", "DEVICE_INFO_GET_REPLY"].includes(data.msgName)) {
        const deviceInfo = data.data?.info;
        const deviceName = deviceInfo?.device_name;
        if (deviceName && deviceInfo) {
            handleDeviceInfoUpdate(deviceName, deviceInfo);
        }
    } else if (
        [
            "DEVICE_ALIASE_SET_REPLY", 
            "OUT_CHANNEL_EDIT_REPLY", 
            "IN_CHANNEL_EDIT_REPLY",
            "LED_CFG_SET_REPLY",
            "STEREO_CFG_SET_REPLY",
            "SPEECH_CFG_SET_REPLY",
            "BLUETOOTH_CFG_SET_REPLY",
            "BLUETOOTH_WHITELIST_ADD_REPLY",
            "BLUETOOTH_WHITELIST_DELETE_REPLY",
            "AMP_CHECK_CFG_SET_REPLY",
            "AUDIO_MATRIX_CFG_SET_REPLY",
            "U_CHANNEL_SET_REPLY",
            "EQ_CFG_SET_REPLY",
            "SPEAKER_VOLUME_SET_REPLY",
        ].includes(data.msgName)
    ) {
        controlDeviceWebsocketSingle(
            hostNameWebsocket, 
            defaultChannelId,
            "deviceInfoGet", 
            data.source
        );
    } else if (data.msgName === "RADIO_FREQ_GET_REPLY") {
        const radioFreqList = data.data?.rf;
        if (radioFreqList && radioFreqList.length > 0) {
            const radioFreqContainer = iframe ? 
                iframe.contentDocument.getElementById('moreEditThingModal-radioFreq-container') : 
                document.getElementById('moreEditThingModal-radioFreq-container');
            if (radioFreqContainer) {
                if (createRadioFreqList && typeof createRadioFreqList === "function") {
                    createRadioFreqList(radioFreqList);
                }
            }
        }
    }  else if (data.msgName === "GET_LOG_REPLY") {
        const logs = data.data?.log;
        const logContainer = iframe ? 
            iframe.contentDocument.getElementById('moreEditThingModal-deviceLog') : 
            document.getElementById('moreEditThingModal-deviceLog');

        if (logContainer) {
            handleLogReply(logs, logContainer);
        }
    }
}

// 处理实时广播相关message
function handleBroadcastMessage(data) {
    // 获取 iframe 元素
    const iframe = document.getElementById('iframePage');
    if (data.msgName === "TASK_START_REPLY") {
        // 实时广播任务开始
        const targetUuid = data?.data?.uuid || "";
        const status = data?.data?.status;
        if (targetUuid && targetUuid.includes('_1')) {
            if (status === 0 || status === -3) {
                //设备会回TaskStartReply，判断status为0（成功），或者-3（TASK_RUNNING）就继续第5步
                if (iframe) {
                    iframe.contentWindow.startTaskThroughSocketBridge(targetUuid);
                } else {
                    startTaskThroughSocketBridge(targetUuid);
                }
            } else {
                //其他就要发送停⽌命令
                if (iframe) {
                    iframe.contentWindow.stopTaskThroughSocketBridge(targetUuid);
                } else {
                    stopTaskThroughSocketBridge(targetUuid);
                }
            }
        }
    } else if (data.msgName === "TASK_START") {
        // 实时广播任务正在运行
        const targetUuid = data?.data?.task?.uuid || "";
        if (targetUuid && targetUuid.includes('_1')) {
            if (iframe) {
                iframe.contentWindow.setTaskIsBroadcastingThroughSocketBridge(targetUuid);
            } else {
                setTaskIsBroadcastingThroughSocketBridge(targetUuid);
            }
        }
    } else if (data.msgName === "SOUND_CONSOLE_TASK_FEEDBACK") {
        const targetUuid = data?.data?.uuid || "";
        if (targetUuid && targetUuid.includes('_1')) {
            if (iframe) {
                iframe.contentWindow.setBroadcastingSongPlayerThroughSocketBridge(data?.data);
            } else {
                setBroadcastingSongPlayerThroughSocketBridge(data?.data);
            }
        }
    }
}

//获取机构id、comID
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
                // setupMessageListener(defaultChannelId);
              }
            })
    } else {
        const url = window.location.href;
        if (url.indexOf("domain") === -1) {
            redirectToLogin();
        }
    }
}

// 设置消息监听器，只调用一次
let isMessageListenerSetup = false;
function setupMessageListener(defaultChannelId) {
    if (isMessageListenerSetup) return;
    isMessageListenerSetup = true;
    window.addEventListener("message", function(event) {
        if (event.data.type === 'websocket-message') {
            const data = event.data.data, 
                  url = window.location.href, 
                  curPageUrl = sessionStorage.getItem("curPageUrl");

            if (curPageUrl) {
                if (
                    url.indexOf("task") !== -1 || 
                    curPageUrl.includes("task")
                ) {
                    // 当前为日程页面
                    handleTaskMessage(data);
                } else if (
                    url.indexOf("things") !== -1 || 
                    curPageUrl.includes("things")
                ) {
                    // 当前为设备页面
                    handleThingMessage(data, defaultChannelId);
                } else if (
                    url.indexOf("broadcast") !== -1 || 
                    curPageUrl.includes("broadcast")
                ) {
                    // 当前为实时广播页面
                    handleBroadcastMessage(data);
                }
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
                    _.cloneDeep(thingsData.things) : [];
            if (allThingsListWebsocket.length && notifyDevice) {
                const url = window.location.href;
                if (url.indexOf("things") !== -1) {
                    // 进入设备页面时，发送请求获取设备信息
					controlDeviceWebsocketToAll(host, comID, "deviceInfoGet");
                }
            }
        })
        .catch(error => {
            allThingsListWebsocket = [];
        });
}

// 给所有设备发送消息
function controlDeviceWebsocketToAll(host, comID, controlType) {
    const out_channel_unique_array = [...new Set(allThingsListWebsocket.map((item) => item.credentials.identity.split('_')[0]))];
    let data = {
        channelID: comID,
        host: host,
        comID: comID,
        controlType: controlType,
        uuid: "",
        username: userInfoWebsocket.credentials.identity,
    };
    async function processRequests() {
        try {
            const promises = out_channel_unique_array.map(async (thingIdentity) => {
                const url = `${protocolWebsocket}//${hostNameWebsocket}:${portSocketBridge}/controlDevice`;
                const queryData = {...data, thingIdentity: thingIdentity};
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": getCookie('session'),
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
        } catch (error) {
            // 捕获意外错误（理论上不会走到这里，因为所有的 Promise 都已经处理）
            console.error("意外错误:", error);
        }
    }

    // 调用异步函数
    processRequests();
}

// 给单个设备发送消息
function controlDeviceWebsocketSingle(host, comID, controlType, thingIdentity) {
    const out_channel_unique_array = [...new Set(allThingsListWebsocket.map((item) => item.credentials.identity.split('_')[0]))];
    let data = {
        channelID: comID,
        host,
        comID,
        controlType,
        username: userInfoWebsocket.credentials.identity,
    };
    const url = `${protocolWebsocket}//${hostNameWebsocket}:${portSocketBridge}/controlDevice`;
    const queryData = {...data, thingIdentity};
    fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData),
    });
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
