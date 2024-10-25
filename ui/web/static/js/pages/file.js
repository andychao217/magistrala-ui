const createFolderModal = new bootstrap.Modal(document.getElementById("createFolderModal")),
        uploadModal = new bootstrap.Modal(document.getElementById("uploadModal")),
        $createFolderNameInputElement = $(`#createFolderName`),
        protocol = window.location.protocol,
        hostname = window.location.hostname,
        domainID = sessionStorage.getItem("domainID"),
        minioBridgePort =  sessionStorage.getItem("minioBridgePort") || "9102";
let comID = "";
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
        loadFilesTable("");
    })
} else {
    redirectToLogin();
}

let breadCrumbFolderList = [], //当前选中文件夹列表
    currentFolderKey = ""; //当前文件夹key

const $fileTable = $('#fileTable');
$fileTable.bootstrapTable({
    selectItemName: 'selectedRows',
    onCheck: updateButtonsState,
    onUncheck: updateButtonsState,
    onCheckAll: updateButtonsState,
    onUncheckAll: function() {
        $('#deleteBtn').prop('disabled', true);
        $('#downloadBtn').prop('disabled', true);
    }
});
$fileTable.removeClass('table-bordered');

document.getElementById("filePreviewModal").addEventListener('hidden.bs.modal', () => {
    const audio = document.getElementById("audioPreview");
    audio.pause(); // 暂停音频播放
    audio.currentTime = 0; // 重置音频到开始位置
    $("#filePreviewModalTitle").empty();
    $("#filePreviewModalContent").empty();
});

const eventSource = new EventSource(`${protocol}//${hostname}:${minioBridgePort}/usbEvents`);

eventSource.onmessage = function(event) {
    const messagesDiv = document.getElementById('messages');
    const newMessage = document.createElement('div');
    newMessage.textContent = event.data;
    messagesDiv.appendChild(newMessage);
};

eventSource.onerror = function(error) {
    console.error('EventSource failed:', error);
};



// 更新批量操作按钮状态
function updateButtonsState() {
    const selectedRows = $fileTable.bootstrapTable('getSelections');
    const hasSelections = selectedRows.length > 0;
    const selectedFolderRows = selectedRows.filter((row) => row.isDir);

    $('#deleteBtn').prop('disabled', !hasSelections);

    if (hasSelections) {
        if (selectedFolderRows.length) {
            $('#downloadBtn').prop('disabled', true);
        } else {
            $('#downloadBtn').prop('disabled', false);
        }
    } else {
        $('#downloadBtn').prop('disabled', true);
    }
}

// 初始化加载文件列表
function loadFilesTable(folder) {
    $fileTable.bootstrapTable('uncheckAll');
    $fileTable.bootstrapTable('load', []);
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
            $fileTable.bootstrapTable('load', data || []);
        }).catch(error => {
            console.error('Error:', error);
        });
}

//表格文件名称列
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

//生成面包屑导航
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

//点击breadCrumb
function onClickBreadcrumbItem(e) {
    const key = e.currentTarget.dataset.key;
    currentFolderKey = key;
    //删除后面的所有文件夹
    const rowIndex = breadCrumbFolderList.findIndex(item => item.key === key);
    breadCrumbFolderList.splice(rowIndex + 1, breadCrumbFolderList.length - rowIndex);

    generateBreadCrumb(breadCrumbFolderList);
    loadFilesTable(key);
}

//点击表格中文件夹
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

//表格文件大小、修改时间列
function fileTableFormatter(value, row, index) {
    if (row.isDir) {
        return '-';
    } else {
        return value;
    }
}

//表格操作列
function actionTableFormatter(value, row, index) {
    if (row.isDir) {
        return '';
    } else {
        const extension = getFileExtension(row.fileName);
        if (extension.toLowerCase() === 'mp3' || extension.toLowerCase() === 'wav') {
            return `<button 
                        class="btn btn-link"
                        title="试听" 
                        onclick="filePreview('${row.fileName}', '${row.key}')"
                        style="height:24px; margin-top: -15px;"
                    >
                        <i class="fa-solid fa-headphones"></i>
                    </button>`;
        } else {
            return '';
        }
    }
}

//预览音频文件
function filePreview(fileName, key) {
    const filePreviewModal = new bootstrap.Modal(document.getElementById("filePreviewModal"));
    filePreviewModal.show();
    $("#filePreviewModalTitle").html(fileName);
    let sourceType = "audio/mpeg";
    const extension = getFileExtension(fileName);
    if (extension.toLowerCase() === 'wav') {
        sourceType = "audio/wav";
    }
    $audio = $(`
        <audio controls autoplay style="width: 100%;" id="audioPreview">
            <source src="${protocol}//${hostname}:${minioBridgePort}/previewFile?key=${key}" type="${sourceType}">
            您的浏览器不支持 audio 元素。
        </audio>
    `);
    $("#filePreviewModalContent").append($audio);
}

//新建文件夹弹窗 名称输入框 表单校验事件
$createFolderNameInputElement.on('change blur keyup', function(event) {
    const value = $(this).val();
    if (value) {
        $(`#createFolderNameError`).empty();
    } else {
        $(`#createFolderNameError`).html('请输入文件夹名称');
    }
});

//新建文件夹
document.getElementById('createFolderForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const currentPath = currentFolderKey ? currentFolderKey : `${comID}/resource`;
    const folderName = $('#createFolderName').val();
    if (!folderName) {
        $(`#createFolderNameError`).html('请输入文件夹名称');
        return;
    } else {
        const tableData =  $fileTable.bootstrapTable('getData');
        const fileNameList = tableData.filter(row => row.isDir).map(row => row.fileName);
        if (fileNameList.length && fileNameList.includes(folderName)) {
            $(`#createFolderNameError`).html('请不要输入重复的文件夹名称');
            return;
        }
        const queryData = { currentPath: "/"+currentPath, folderName: folderName };
        fetch(`${protocol}//${hostname}:${minioBridgePort}/createFolder`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                "Authorization": getCookie('session'),
            },
            body: JSON.stringify(queryData)
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    createFolderModal.hide();
                    loadFilesTable(currentFolderKey);
                } else {
                    showAlert("danger", '新建文件夹失败: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showAlert("danger", '新建文件夹失败');
            });
    }
});

//删除文件
function deleteFile() {
    const selectedRows = $fileTable.bootstrapTable('getSelections');
    if (selectedRows.length) {
        showConfirmModal("确定要删除所选数据吗？", () => {
            const keyList = selectedRows.map(row => row.key);
            const queryData = { keyList: keyList };
            fetch(`${protocol}//${hostname}:${minioBridgePort}/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": getCookie('session'),
                },
                body: JSON.stringify(queryData)
            })
                .then(response => response.json())
                .then(data => {
                    loadFilesTable(currentFolderKey);
                })
                .catch(error => {
                    loadFilesTable(currentFolderKey);
                    console.error('Error:', error);
                });
        });
    } else {
        showAlert('info', '请选择要删除的数据');
    }
}

//点击下载文件按钮
function onClickDownloadFileBtn() {
    const selectedRows = $fileTable.bootstrapTable('getSelections');
    if (selectedRows.length) {
        selectedRows.forEach((row, index) => {
            const queryData = { key: row.key };
            fetch(`${protocol}//${hostname}:${minioBridgePort}/download`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": getCookie('session'),
                },
                body: JSON.stringify(queryData)
            })
            .then(response => response.blob())
            .then(blob => {
                const extension = getFileExtension(row.fileName);
                let contentType = 'application/octet-stream';
                if (extension === 'mp3') {
                    contentType = 'audio/mpeg';
                } else if (extension === 'wav') {
                    contentType = 'audio/wav';
                }
                downloadFile(blob, row.fileName, contentType);
            });
        });
    }
}

//下载文件
function downloadFile(content, fileName, contentType) {
    // 创建一个 Blob 对象
    const blob = new Blob([content], { type: contentType });
    // 创建一个 URL 对象
    const url = window.URL.createObjectURL(blob);
    // 创建一个 a 标签
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    // 将 a 标签添加到 DOM 中（这一步不是必须的，但可以确保兼容性）
    document.body.appendChild(a);
    // 触发点击事件
    a.click();
    // 移除 a 标签
    document.body.removeChild(a);
    // 释放 URL 对象
    window.URL.revokeObjectURL(url);
}

const dropzone = document.getElementById('dropzone'),
        fileInput = document.getElementById('fileInput'),
        uploadButton = document.getElementById('uploadButton'),
        progressBar = document.getElementById('progressBar'),
        fileList = document.getElementById('fileList');
let selectedFiles = new DataTransfer();

//打开弹窗
function openModal(modal) {
    if (modal === "createFolder") {
        createFolderModal.show();
        $("#createFolderName").val('');
        $("#createFolderNameError").empty();
    } else if (modal === "upload") {
        uploadModal.show();
        fileInput.value = ''; // Clear the file input
        fileList.innerHTML = ''; // Clear the file list
        selectedFiles = new DataTransfer();
    }
}

dropzone.addEventListener('click', () => fileInput.click());
dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#20afbf';
});
dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = '#cccccc';
});
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = '#cccccc';
    handleFiles(e.dataTransfer.files);
    const files = Array.from(fileInput.files);
    const dataTransfer = new DataTransfer();
    files.push(...e.dataTransfer.files);
    files.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    selectedFiles = dataTransfer;
});
fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    const files = Array.from(fileInput.files);
    files.forEach(file => selectedFiles.items.add(file));
    fileInput.files = selectedFiles.files;
});
uploadButton.addEventListener('click', () => {
    if (fileInput.files.length) {
        handleUpload(fileInput.files);
    } else {
        showAlert('info', '请选择文件');
    }
});

function handleFiles(files) {
    const allowedTypes = ['audio/mpeg', 'audio/wav'];
    for (const file of files) {
        if (allowedTypes.includes(file.type)) {
            const li = document.createElement('li');
            li.className = 'fileItem';
            li.textContent = file.name;

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            deleteButton.addEventListener('click', () => {
            li.remove();
                updateFileInput();
            });

            li.appendChild(deleteButton);
            fileList.appendChild(li);
        } else {
            showAlert('warning', `此文件类型不受支持, 请选择.mp3或者.wav类型的文件`);
        }
    }
}

function updateFileInput() {
    const fileItems = fileList.querySelectorAll('.fileItem');
    const files = Array.from(fileInput.files);
    const newFiles = files.filter(file => {
        return Array.from(fileItems).some(item => item.textContent.includes(file.name));
    });
    const dataTransfer = new DataTransfer();
    newFiles.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    selectedFiles = dataTransfer;
}

function handleUpload(files) {
    const formData = new FormData();
    for (const file of files) {
        formData.append('files', file);
        const path = currentFolderKey ? currentFolderKey : `${comID}/resource`; // 或者从其他地方获取路径
        formData.append('filePath', path);
    }
    progressBar.style.display = 'block';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${protocol}//${hostname}:${minioBridgePort}/upload`, true);
    xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            progressBar.value = percentComplete;
        }
    };
    xhr.onload = () => {
        if (xhr.status === 200) {
            uploadModal.hide();
            loadFilesTable(currentFolderKey);
        } else {
            showAlert('danger', '上传失败');
        }
        progressBar.style.display = 'none';
        progressBar.value = 0;
    };
    xhr.send(formData);
}