//查看详情
function viewUser(id) {
    window.location.href = '/ui/users/' + id;
}

function editUser(id, name) {
    editUserModal.show();
    $("#editName").val(name);
    $("#editID").val(id);
}

function openModal(modal) {
    if (modal === "single") {
        userModal.show();
    } else if (modal === "bulk") {
        usersModal.show();
    }
}

//删除
function deleteUser(userID) {
    // 显示确认对话框
    showConfirmModal("确定要删除所选数据吗？", ()=>{
        fetch(`/ui/users/${userID}`, {
            method: "DELETE",
        })
        .then(response => {
            window.location.reload();
        })
    });
}