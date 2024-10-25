const protocol = window.location.protocol,
        hostname = window.location.hostname,
        minioBridgePort =  sessionStorage.getItem("minioBridgePort") || "9102",
        userInfoStr = sessionStorage.getItem("userInfo"),
        userInfo = JSON.parse(userInfoStr),
        updateDeviceModal = new bootstrap.Modal(document.getElementById("updateDeviceModal")),
        $updateDeviceTable = $('#updateDeviceTable');
let categorizedThings = {}, latestFirmwares = [], curProductName = '';

$updateDeviceTable.bootstrapTable({
    fixedColumns: true,
    fixedNumber: 1,
    fixedRightNumber: 1,
});
$updateDeviceTable.removeClass('table-bordered');

$(document).ready(function() {
    getThingsList();

    // 刷新按钮
    $("#refreshBtn").click(function() {
        getThingsList();
    });

    // 升级全部按钮
    $('#updateAllBtn').click(function() {
        const latestVersionInfo = latestFirmwares.find(item => item.product_name === curProductName);
        const thingsList = _.cloneDeep(categorizedThings[curProductName]);
        const canUpdateThings = thingsList.filter(
            item => item.metadata?.info?.sw_version !== latestVersionInfo.newest_version && item.metadata?.is_online === "1"
        );
        if (canUpdateThings.length) {
            const cancelCallback = function () {
                updateDeviceModal.show();
            };
            updateDeviceModal.hide();
            showConfirmModal("确定要更新固件吗？", () => {
                canUpdateThings.forEach(tagetThing => {
                    const data = {
                        controlType:  "deviceUpgrade", 
                        thingIdentity: tagetThing.credentials.identity,
                        firmwareUrl: `oss://nxt-device/firmware/${curProductName}/${curProductName}_[Std]_${latestVersionInfo.newest_version}.img`
                    };
                    controlThing(data);
                });
                updateDeviceModal.hide();
                getThingsList();
            }, cancelCallback);
        } else {
            showAlert('warning', `设备已经全部是最新版本了`);
        }
    });
});

// 获取设备列表                
function getThingsList() {
    getLatestFirmwares();
    categorizedThings = {};
    fetch(`/ui/things/thingsInJSON?limit=1000&onlineStatus=2&showFullData=true`, {
        method: "GET",
    })
        .then(response => {
            if (!response.ok) {
                renderProductCards();
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
            //将设备按照产品型号分类
            if (things.length) {
                categorizedThings = things.reduce((acc, thing) => {
                    const productName = thing.metadata.product_name;
                    // 如果当前 product_name 不在 accumulator 中，则初始化一个空数组
                    if (!acc[productName]) {
                        acc[productName] = [];
                    }
                    // 将当前 thing 添加到对应的 product_name 数组中
                    acc[productName].push(thing);
                    return acc;
                }, {});
                renderProductCards(categorizedThings)
            }
        })
        .catch(error => {
            renderProductCards();
        });
}

// 渲染产品卡片
function renderProductCards(products) {
    $('#productsGrid').empty();
    if (Object.keys(products).length) {
        Object.keys(products).forEach(product => {
            const deviceIcon = getDeviceIcon({product_name: product});
            const imgSpan = `<img loading="lazy" src="/images/${deviceIcon}" class="hoverCardIcon" />`;
            const btnSpan = `
                <button 
                    class="btn btn-link" 
                    type="button" 
                    style="text-decoration: none;" 
                    onclick="openUpdateDeviceModal('${product}')"
                >
                    更新
                </button>
            `;
            const $productCard = $(`
                <div class="cards-grid">
                    <div class="hoverCard card">
                        <div class="card-body">
                            <div class="row">
                                <div class="col">
                                    ${imgSpan}
                                </div>
                                <div class="col" style="text-align: right;">
                                    ${btnSpan}
                                </div>
                            </div>
                            <div class="row" style="margin-top:50px">
                                <h5 
                                    class="card-title truncate-text" 
                                    data-bs-toggle="tooltip" 
                                    data-bs-placement="bottom" 
                                    data-bs-title="${product}"
                                    title="${product}"
                                >
                                    ${product}
                                </h5>
                            </div>
                        </div>
                    </div>
                </div>
            `); 
            $(`#productsGrid`).append($productCard);
        });
    }
}

// 打开更新设备模态框
function openUpdateDeviceModal(productName) {
    curProductName = productName;
    $('#updateDeviceModalTitle').text(productName);
    updateDeviceModal.show();
    $updateDeviceTable.bootstrapTable('load', categorizedThings[productName]);
}

//表格产品图标列
function productIconUpdateDeviceTableFormatter(value, row, index) {
    const product_name = row.metadata?.info?.product_name || row.product_name;
    const onlineStatus = row.metadata?.is_online;
    let src = '';
    if (product_name.includes('2204')) {
        src = '/images/icon_device1_dis.svg';
        if (onlineStatus === "1") {
            src = '/images/icon_device1.svg';
        }
    } else if (product_name.includes('2102')) {
        src = '/images/icon_device2_dis.svg';
        if (onlineStatus === "1") {
            src = '/images/icon_device2.svg';
        }
    } else if (product_name.includes('3602')) {
        src = '/images/icon_device8_dis.svg';
        if (onlineStatus === "1") {
            src = '/images/icon_device8.svg';
        }
    }
    return `<img loading="lazy" src=${src} style="height:25px;" />`;
}

//表格设备型号列
function productNameUpdateDeviceTableFormatter(value, row, index) {
    return row.name;
}

//表格当前版本列
function versionUpdateDeviceTableFormatter(value, row, index) {
    return row.metadata?.info?.sw_version
}

//表格最新版本列
function newVerUpdateDeviceTableFormatter(value, row, index) {
    const product_name = row.metadata?.info?.product_name || row.product_name;
    const latestVersionInfo = latestFirmwares.find(item => item.product_name === product_name);
    return latestVersionInfo?.newest_version || "";
}

//操作列
function actionFirmwareTableFormatter(value, row, index) {
    const product_name = row.metadata?.info?.product_name || row.product_name;
    const latestVersionInfo = latestFirmwares.find(item => item.product_name === product_name);
    if (
        latestVersionInfo?.newest_version && 
        latestVersionInfo.newest_version !== row.metadata?.info?.sw_version && 
        row.metadata?.is_online === "1"
    ) {
        return `
            <div class="btn-group">
                <button 
                    class="btn btn-link"
                    title="升级" 
                    style="height:24px; margin-top: -15px; color: orange;"
                    onclick="updateDevice('${row.id}')"
                >
                    <i class="fa-solid fa-upload"></i>
                </button>
            </div>
        `;
    } else {
        return '';
    }
}

//更新设备
function updateDevice(deviceId) {
    const cancelCallback = function () {
        updateDeviceModal.show();
    };
    updateDeviceModal.hide();
    showConfirmModal("确定要更新固件吗？", () => {
        const callback = function () {
            updateDeviceModal.hide();
            getThingsList();
        }
        const tagetThing = categorizedThings[curProductName].find(item => item.id === deviceId);
        const product_name = tagetThing.metadata?.info?.product_name || tagetThing.product_name;
        const latestVersionInfo = latestFirmwares.find(item => item.product_name === product_name);
        const data = {
            controlType:  "deviceUpgrade", 
            thingIdentity: tagetThing.credentials.identity,
            firmwareUrl: `oss://nxt-device/firmware/${product_name}/${product_name}_[Std]_${latestVersionInfo.newest_version}.img`
        };
        controlThing(data, callback);
        
    }, cancelCallback);
}

//获取最新版本信息
function getLatestFirmwares() {
    latestFirmwares = [];
    const queryData = {
        product_name_list: ['NXT2102', 'NXT2204', 'NXT3602'],
    }
    fetch(`${protocol}//${hostname}:${minioBridgePort}/getLatestFirmwares`, {
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
            if (data && data.latest_firmwares && data.latest_firmwares.length) {
                latestFirmwares = _.cloneDeep(data.latest_firmwares);
            }
        })
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