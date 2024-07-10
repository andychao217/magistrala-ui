var ws = null;
const hostName = getHostname(window.location);

function getHostname(url) {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname;
}

function connectWebSocket(host, port, defaultChannelId) {
    // 假设WebSocket服务器在ws://your-websocket-server-url
    ws = new WebSocket(`ws://${host}:${port}/websocket`);

    ws.onopen = function (event) {
        console.log("WebSocket is open now.");
        // 可以在这里发送初始消息等
        // getChannelsAndSendMessage(host)
        const topics = [`channels/${defaultChannelId}/messages`];
        const message = { topics: topics.join(";"), host: hostName, thingSecret: "platform"+defaultChannelId, message: "connect" };
        ws.send(JSON.stringify(message));
    };

    ws.onmessage = function (event) {
        console.log("Received data from server: ", event.data);
        // 处理从服务器接收到的数据
    };

    ws.onclose = function (event) {
        if (event.wasClean) {
            console.log("WebSocket closed cleanly, code=" + event.code + " reason=" + event.reason);
        } else {
            // 例如，服务器进程被终止，代码可能不是1000
            console.error("WebSocket disconnected unexpectedly (code=" + event.code + " reason=" + event.reason + ")");
        }
        // 可以在这里尝试重新连接
    };

    ws.onerror = function (error) {
        console.error("WebSocket Error: ", error);
        connectWebSocket(host, port, defaultChannelId);
    };
}

function getChannelsAndSendMessage(ip) {
    let domID = "";
    if (userInfoStr) {
        const userInfo = JSON.parse(userInfoStr);
        domID = userInfo.metadata.domID;
    }
    
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
            const topics = channels.map((channel) => `channels/${channel.id}/messages`);
            const message = { topics: topics.join(";"), host: hostName, thingSecret: "platform"+domID, message: "connect" };
            ws.send(JSON.stringify(message));
        });
}

$(function () {
    // DOM 加载完成后执行的代码
    if (!containsLoginInUrl()) {
        //获取当前domain的ID号
        // const domainLinkElement = document.getElementById("domain");
        // const domainHrefValue = domainLinkElement.href;
        // const domainID = domainHrefValue.split("/").pop();
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
                    connectWebSocket(hostName, port, defaultChannelId);
                  }
                })
        }
    }
});
