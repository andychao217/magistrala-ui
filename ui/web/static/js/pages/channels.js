// const channelModal = new bootstrap.Modal(document.getElementById("addChannelModal")),
// 	  channelsModal = new bootstrap.Modal(document.getElementById("addChannelsModal")),
// 	  editChannelModal = new bootstrap.Modal(document.getElementById("editChannelModal"));

function openModal(modal) {
    if (modal === "single") {
        channelModal.show();
    } else if (modal === "bulk") {
        channelsModal.show();
    }
}

function editChannel(id, name, description) {
    editChannelModal.show();
    $("#editName").val(name);
    $("#editId").val(id);
    $("#editDescription").val(description);
}

function viewChannel(id, event) {
    // 使用 event 对象进行判断或其他操作
    if (
        event.target.classList.contains('dropdown-item') || 
        event.target.classList.contains('dropdown-toggle')
    ) {
        // 阻止事件冒泡或默认行为
        event.stopPropagation();
    } else {
        const onlineStatus = "1";
        sessionStorage.setItem("onlineStatus", onlineStatus);
        window.location.href = `/ui/channels/${id}/things?limit=1000&onlineStatus=${onlineStatus}&showFullData=true`;
    }
}

//删除
function deleteChannel(channelID) {
    // 显示确认对话框
    showConfirmModal("确定要删除所选数据吗？", ()=>{
        fetch(`/ui/channels/${channelID}/thingsInJSON?page=1&limit=1000&showFullData=false`, {
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
            const fetchPromises = things.map((thing) => disconnectThingsAndChannels(thing.id, channelID));
            Promise.all(fetchPromises).then(responses => {})
                .then(jsonData => { handleDelete(channelID) })
                .catch(error => {
                    // 如果有任何错误发生，这里会捕获到
                    console.error('An error occurred:', error);
                });
        });
    });
}

function handleDelete(channelID) {
    fetch(`/ui/channels/${channelID}`, {
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
            window.location.reload();
        }
    })
    .catch((error) => {
        window.location.reload();
        console.error("error submitting form: ", error);
    });
}