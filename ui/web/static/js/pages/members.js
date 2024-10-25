const memberModal = new bootstrap.Modal(document.getElementById("addMemberModal")),
        domainID = sessionStorage.getItem("domainID");
        
if (userRole == "admin") {
    document.getElementById("add-member-button").style.display = "block";
} else {
    document.getElementById("add-member-button").style.display = "none";
}

function openMemberModal() {
    memberModal.show();
}

function viewMember(identity) {
    window.location.href = '/ui/domains/members?identity=' + identity;
}

function unassignMember(id) {
    const relations = ['administrator', 'editor', 'viewer', 'member'];
    
    async function processRequests() {
        try {
            const promises = relations.map(async (relation) => {
                const requestData = new URLSearchParams();
                requestData.append("userID", [id]);
                requestData.append("relation", relation);
                const response = await fetch(`/ui/domains/${domainID}/unassign`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                    body: requestData.toString(),
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
            window.location.reload();
        } catch (error) {
            // 捕获意外错误（理论上不会走到这里，因为所有的 Promise 都已经处理）
            console.error("意外错误:", error);
        }
    }

    // 调用异步函数
    processRequests();
}