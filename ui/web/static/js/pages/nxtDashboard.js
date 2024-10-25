const myChart = echarts.init(document.getElementById('myChart'));
        
// 指定图表的配置项和数据
let option = {
    tooltip: {
        trigger: 'item'
    },
    legend: {
        top: '5%',
        left: 'center'
    },
    series: [
        {
            name: '设备',
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            padAngle: 5,
            itemStyle: {
                borderRadius: 10
            },
            label: {
                show: false,
                position: 'center'
            },
            emphasis: {
                label: {
                    show: true,
                    fontSize: 40,
                    fontWeight: 'bold'
                }
            },
            labelLine: {
                show: false
            },
            data: [
                { value: 0, name: '在线', itemStyle: {color:'#D4B897'} },
                { value: 0, name: '离线', itemStyle: {color:'#bbbcbc'} },
            ]
        }
    ]
};

myChart.setOption(option);

refreshThingsPieChart();

//  更新最新的设备数量信息
function refreshThingsPieChart () {
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
        const things = thingsData.things.filter((thing)=>{
            //identity 中有下划线则表示为多通道，默认在设备页面隐藏
            return !thing.credentials.identity.includes("_");
        }) || [];
        let onlineThingsQuantity = 0, offlineThingsQuantity = 0, totalThingsQuantity = 0;
        if (things.length) {
            const onlineThings = things.filter((thing)=>{
                if (thing.metadata && thing.metadata.is_online && thing.metadata.is_online === "1") {
                    return true;
                } else {
                    return false;
                }
            });
            const offlineThings = things.filter((thing)=>{
                if (!thing.metadata || !thing.metadata.is_online || thing.metadata.is_online !== "1") {
                    return true;
                } else {
                    return false;
                }
            });
            onlineThingsQuantity = onlineThings.length;
            offlineThingsQuantity = offlineThings.length;
            totalThingsQuantity = things.length;
        }
        option.series[0].data[0].value = onlineThingsQuantity;
        option.series[0].data[1].value = offlineThingsQuantity;
        myChart.setOption(option);
        $(`#totalThingsCardTitle`).html(totalThingsQuantity);
    })
    .catch(error => {
        option.series[0].data[0].value = 0;
        option.series[0].data[1].value = 0;
        myChart.setOption(option);
        $(`#totalThingsCardTitle`).html(0);
    });
}

// 启动轮询
function startPollingIndex() {
    return setInterval(refreshThingsPieChart, 2000); // 每5秒轮询一次
}

// 清理并重启轮询
function resetPollingIndex(intervalId) {
    clearInterval(intervalId);
    return startPollingIndex();
}

// 停止轮询
function stopPollingIndex() {
    if (pollingIntervalIdIndex) {
        clearInterval(pollingIntervalIdIndex);
        pollingIntervalIdIndex = null;
    }
}

// 初始启动轮询
let pollingIntervalIdIndex = startPollingIndex();

// 每10分钟清理并重启轮询
let resetPollingIndexInterval = setInterval(function() {
    pollingIntervalIdIndex = resetPollingIndex(pollingIntervalIdIndex);
}, 10 * 60 * 1000); // 10分钟

// 在组件卸载时停止调用
window.addEventListener('beforeunload', () => {
    stopPollingIndex();
    clearInterval(resetPollingIndexInterval);
    resetPollingIndexInterval = null;
});