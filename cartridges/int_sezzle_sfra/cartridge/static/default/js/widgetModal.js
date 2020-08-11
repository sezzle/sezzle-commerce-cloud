if (document.getElementsByClassName('sezzle-error').length &&
    document.getElementsByClassName('sezzle-error')[0].innerText !== 'undefined') {
    alert(document.getElementsByClassName('sezzle-error')[0].innerText);
}
// getModal : Getting Sezzle modal
function getModal(modalNode, callback) {
    var httpRequest = new XMLHttpRequest();

    httpRequest.onreadystatechange = function () {
        if (httpRequest.readyState === XMLHttpRequest.DONE) {
            if (httpRequest.status === 200) {
                // append the html to the modal node
                modalNode.innerHTML = httpRequest.response;
                document.getElementsByTagName('html')[0].appendChild(modalNode);
                callback();
            } else {
                return console.warn("Can't load the modal because the link provided is not found");
            }
        }
    }.bind(this);

    var url = 'https://media.sezzle.com/shopify-app/assets/sezzle-modal-2.0.0-en.html';
    httpRequest.open('GET', url, true);
    httpRequest.send();
}

// closeModalHandler : Close modal handler
function closeModalHandler() {
    // Event listener for close in modal
    Array.prototype.forEach.call(document.getElementsByClassName('close-sezzle-modal'), function (el) {
        el.addEventListener('click', function () {
            modalNode.style.display = 'none';
        });
    }); // Event listener to prevent close in modal if click happens within sezzle-checkout-modal

    var sezzleModal = document.getElementsByClassName('sezzle-modal')[0]; // backwards compatability check

    if (!sezzleModal) sezzleModal = document.getElementsByClassName('sezzle-checkout-modal')[0];
    sezzleModal.addEventListener('click', function (event) {
        // stop propagating the event to the parent sezzle-checkout-modal-lightbox to prevent the closure of the modal
        event.stopPropagation();
    });
}

var modalNode = document.createElement('div');

if (!document.getElementsByClassName('sezzle-checkout-modal-lightbox').length) {
    modalNode.className = 'sezzle-checkout-modal-lightbox close-sezzle-modal';
    modalNode.style.display = 'none';
    getModal(modalNode, closeModalHandler);
} else {
    modalNode.innerHTML = document.getElementsByClassName('sezzle-checkout-modal-lightbox')[0];
}

document.getElementsByClassName('sezzle-know-more')[0].addEventListener('click', function (event) {
    modalNode.style.display = 'block';
});





