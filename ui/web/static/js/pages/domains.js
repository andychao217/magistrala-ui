$(document).ready(function() {
    const curDomainID = sessionStorage.getItem("domainID"),
          userInfoStr = sessionStorage.getItem("userInfo");

    if(userInfoStr) {
        $('.domainTip').removeClass("active");
        const userInfo = JSON.parse(userInfoStr);
            //如果sessionStorage中domainID为空说明刚进入系统，则默认进入userInfo中保存的domain
        if (!curDomainID) {
            const defaultDomainID = userInfo.metadata?.domainID;
            selectDomain(defaultDomainID, false);
        } else {
            $(`.domainTip[data-id="${curDomainID}"]`).addClass('active');
        }
    } else {
        // 如果sessionStorage没保存userInfo则重新获取一次
        fetch("/ui/userProfile", {
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
            const userInfo = JSON.parse(data).user;
            sessionStorage.setItem("userInfo", JSON.stringify(userInfo))
            if(userInfo.metadata && userInfo.metadata.domainID){
                selectDomain(userInfo.metadata.domainID, false);
            }
        })
        .catch(error => {
            console.error('处理fetch或JSON时出错:', error);
        });
    }
    
    if (role === 'admin') {
        const domainTitles = $('h5.domain-title');
        domainTitles.each(function() {
            const domainTitle = $(this).attr('data-domain_title');
            $(this).html(domainTitle);
        });
    }
});

//切换domain
function selectDomain(domainID, showConfirm){
    const httpSelectDomain = () => {
        let formData = new FormData();
        formData.append("domainID", domainID);
        fetch( "/ui/domains/login" ,  {
                method: "POST",
                body: formData,
            }
        )
            .then(function (response) {
                if (!response.ok) {
                    const errorMessage = response.headers.get("X-Error-Message");
                    if (errorMessage) {
                        showAlert("danger", errorMessage);
                    } else {
                        showAlert("danger", `Error: ${response.status}`);
                    }
                } else {
                    sessionStorage.setItem("domainID", domainID);
                    //选择domain之后要更新一下userInfo中保存的domain信息
                    updateUserSelectedDomain(domainID);
                    const url = `/ui`;
                    if (window.self !== window.top) {
                        // 当前窗口在 iframe 中 
                        window.parent.location.href = url;
                    } else {
                        // 当前窗口不在 iframe 中
                        window.location.href = url;
                    }
                }
            })
            .catch((error) => {
                console.error("error submitting form: ", error);
                showAlert("danger", `Error: ${error}`);
            });
    }
    if (showConfirm) {
        showConfirmModal("确定要切换机构吗？", () => {
            httpSelectDomain();
        });
    } else {
        httpSelectDomain();
    }
}

//更新userInfo中保存的domain信息
function updateUserSelectedDomain(domainID){
    let userInfo = JSON.parse(sessionStorage.getItem("userInfo") || "{}");
    userInfo['metadata']['domainID'] = domainID;
    userInfo['metadata']['comID'] = userInfo.metadata[domainID];
    const queryData = {...userInfo};
    fetch( `/ui/users/${userInfo.id}` ,  {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(queryData),
    }).then((response) => {
        if (!response.ok) {
            throw new Error("Network response was not ok");
        } else {
            sessionStorage.setItem("userInfo", JSON.stringify(queryData));
            console.log("updated userInfo succeed 123")
        }
    })
    .catch((error) => {});
}