const protocol = window.location.protocol,
      hostname = window.location.hostname,
      minioBridgePort =  sessionStorage.getItem("minioBridgePort") || "9102",
      userInfoStr = sessionStorage.getItem("userInfo"),
      userInfo = JSON.parse(userInfoStr),
      firmwareListModal = new bootstrap.Modal(document.getElementById("firmwareListModal")),
      $firmwareListTable = $('#firmwareListTable');
const initFirmwareList = [
    {
        id: 1,
        product_name: 'NXT2102',
        newest_version: '',
    },
    {
        id: 2,
        product_name: 'NXT2204',
        newest_version: '',
    },
    {
        id: 3,
        product_name: 'NXT3602',
        newest_version: '',
    },
    {
        id: 4,
        product_name: 'NXT3603',
        newest_version: '',
    },
    {
        id: 5,
        product_name: 'XC9823A',
        newest_version: '',
    },
];

const $fileTable = $('#fileTable');
$fileTable.bootstrapTable({});
$fileTable.removeClass('table-bordered');

$firmwareListTable.bootstrapTable({});
$firmwareListTable.removeClass('table-bordered');

let curProductName = '', curProductFirmwareList = [];

loadFirmwareTable();

function loadFirmwareTable() {
    $fileTable.bootstrapTable('load', initFirmwareList);
    const queryData = {
        product_name_list: initFirmwareList.map(item => item.product_name),
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
                const firmwareList = _.cloneDeep(initFirmwareList);
                for (const item of data.latest_firmwares) {
                    for (let i = 0; i < firmwareList.length; i++) {
                        if (firmwareList[i].product_name === item.product_name) {
                            firmwareList[i].newest_version = item.newest_version;
                            break;
                        }
                    }
                }
                $fileTable.bootstrapTable('load', firmwareList);
            }
        }).catch(error => {
            console.error('Error:', error);
        });
}

//表格产品图标列
function productIconTableFormatter(value, row, index) {
    let src = '';
    if (row.product_name.includes('2204')) {
        src = '/images/logo_2204.png';
    } else if (row.product_name.includes('2102')) {
        src = '/images/logo_2102.png';
    } else if (row.product_name.includes('3602') || row.product_name.includes('3603') || row.product_name.includes('9823')) {
        src = '/images/logo_3602.png';
    }
    return `<img loading="lazy" src=${src} style="height:40px;" />`;
}

function actionTableFormatter(value, row, index) {
    const isDisabled = !row.newest_version;
    return `
        <div class="btn-group">
            <button 
                class="btn btn-link" 
                title="固件列表" 
                ${isDisabled ? 'disabled' : ''}
                onclick="getFirmwareList('${row.product_name}')"
                style="height:24px; margin-top: -15px;"
            >
                <i class="fa-solid fa-list"></i>
            </button>
            <button 
                class="btn btn-link"
                title="上传固件" 
                onclick="openUploadModal('${row.product_name}')"
                style="height:24px; margin-top: -15px;"
            >
                <i class="fa-solid fa-upload"></i>
            </button>
        </div>
    `;
}

function getFirmwareList(product_name) {
    $('#firmwareListModalTitle').html('');
    $('#firmwareListModalTitle').html(product_name);
    
    firmwareListModal.show();
    $firmwareListTable.bootstrapTable('load', []);

    const queryData = { product_name };
    fetch(`${protocol}//${hostname}:${minioBridgePort}/getFirmwareList`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData)
    })
        .then(response => response.json())
        .then(data => {
            if (data && data.length) {
                $firmwareListTable.bootstrapTable('load', data);
            }
        })
}

function actionFirmwareTableFormatter(value, row, index) {
    return `
        <div class="btn-group">
            <button 
                class="btn btn-link"
                title="删除固件" 
                onclick="deleteFirmware('${row.id}', '${row.product_name}')"
                style="height:24px; margin-top: -15px; color: orangered;"
            >
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </div>
    `;
}

function deleteFirmware(id, product_name) {
    firmwareListModal.hide();
    const cancelCallback = function () {
        firmwareListModal.show();
    };
    const callback = function () {
        firmwareListModal.show();
        getFirmwareList(product_name);
        loadFirmwareTable();
    }
    showConfirmModal("确定要删除所选固件吗？", () => {
        const queryData = { id, product_name };
        fetch(`${protocol}//${hostname}:${minioBridgePort}/deleteFirmware`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": getCookie('session'),
            },
            body: JSON.stringify(queryData)
        })
            .then(response => {
                callback();
                return response.json();
            })
            .then(data => {
                callback();
            })
            .catch(error => {
                callback();
                console.error('Error:', error);
            });
    }, cancelCallback);
}

const uploadModal = new bootstrap.Modal(document.getElementById("uploadModal")),
        fileInput = document.getElementById('fileInput'),
        uploadButton = document.getElementById('uploadButton'),
        fileInputLabel = document.getElementById('fileInputLabel'),
        progressBar = document.getElementById('progressBar');

//打开弹窗
function openUploadModal(product_name = '') {
    curProductName = product_name;
    uploadModal.show();
    fileInput.value = '';
    $('#fileInputLabel').val('');
    const queryData = { product_name };
    curProductFirmwareList = [];
    fetch(`${protocol}//${hostname}:${minioBridgePort}/getFirmwareList`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "Authorization": getCookie('session'),
        },
        body: JSON.stringify(queryData)
    })
        .then(response => response.json())
        .then(data => {
            if (data && data.length) {
                curProductFirmwareList = _.cloneDeep(data);
            }
        })
}
fileInputLabel.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    const allowedExtension = '.img'; // 允许的扩展名
    const targetFile = e.target.files[0];
    if (!targetFile?.name?.endsWith(allowedExtension)) {
        showAlert('warning', `上传文件格式不正确, 请选择img格式`);
        fileInput.value = '';
        $('#fileInputLabel').val('');
        return;
    }
    const file_name = targetFile.name;
    if (!file_name.includes(curProductName)) {
        showAlert('warning', `该固件不适用对应设备, 请重新选择`);
        fileInput.value = '';
        $('#fileInputLabel').val('');
        return;
    }
    const curProductFirmwareListVersions = curProductFirmwareList.map(item => item.version);
    // 去掉文件扩展名
    const baseFileName = file_name.split('.').slice(0, -1).join('.');
    // 使用正则表达式匹配想要的部分
    const match = baseFileName.match(/_(.*)$/);
    if (match) {
        const result = match[1];
        if (curProductFirmwareListVersions.includes(result)) {
            showAlert('warning', `该固件版本已存在, 请重新选择`);
            fileInput.value = '';
            $('#fileInputLabel').val('');
            return;
        }
    }
    $('#fileInputLabel').val(targetFile?.name);
});
uploadButton.addEventListener('click', () => {
    if (fileInput.files?.length) {
        handleUpload(fileInput.files);
    } else {
        showAlert('info', '请选择文件');
    }
});

function handleUpload(files) {
    const formData = new FormData();
    for (const file of files) {
        const file_name = file.name;
        // 去掉文件扩展名
        const baseFileName = file_name.split('.').slice(0, -1).join('.');
        
        // 使用正则表达式分组
        const match = baseFileName.match(/^(.*?)\_([\s\S]*)$/);
        if (match) {
            const product_name = match[1];
            const version = match[2];
            formData.append('files', file);
            formData.append('upload_user', userInfo.credentials.identity);
            formData.append('product_name', product_name);
            formData.append('version', version);
        }
    }
    progressBar.style.display = 'block';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${protocol}//${hostname}:${minioBridgePort}/uploadFirmware`, true);
    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.value = percentComplete;
        }
    };
    xhr.onload = () => {
        if (xhr.status === 200) {
            uploadModal.hide();
            loadFirmwareTable();
        } else {
            showAlert('danger', '上传失败');
        }
        progressBar.style.display = 'none';
        progressBar.value = 0;
    };
    xhr.send(formData);
}