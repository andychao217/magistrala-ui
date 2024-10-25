const editDomainModal = new bootstrap.Modal(document.getElementById("editDomainModal"));

function editDomain(name, alias, metadata) {
    editDomainModal.show();
    $("#edit-domain-name").val(name);
    $("#edit-domain-alias").val(alias);
}

function saveDomain(id, metadata) {
    const queryData = {
        id,
        metadata: JSON.parse(metadata),
        name: $('#editDomainform input[name="name"]').val(),
        alias: $('#editDomainform input[name="alias"]').val(),
    }

    fetch(`/ui/domains/${id}`, {
        method: "POST",
        body: JSON.stringify(queryData),
        headers: {
            "Content-Type": "application/json",
        },
    })
        .then((response) => {
            if (!response.ok) {
                const errorMessage = response.headers.get("X-Error-Message");
                if (errorMessage) {
                    showAlert("danger", errorMessage);
                } else {
                    showAlert("danger", `Error: ${response.status}`);
                }
            } else {
                window.location.reload();
            }
        })
        .catch((error) => {
            console.error("error submitting form: ", error);
            showAlert("danger", `错误: ${error}`, config.alertDiv);
        });
}