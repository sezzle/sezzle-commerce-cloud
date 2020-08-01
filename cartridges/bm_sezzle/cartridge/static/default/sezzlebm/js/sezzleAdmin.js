/* global Ext jQuery */

var sezzleAdmin = (function ($) {
    var actionFormWindow;
    var transactionDetailWindow;
    var $window = $(window);

    function initTextareaCharectersLeft(parent) {
        parent = parent || document; // eslint-disable-line no-param-reassign
        $(parent).find('textarea[data-maxcount]').each(function () {
            var $textarea = $(this);
            var maxCount = $textarea.data('maxcount');
            var $countInput = $textarea.parent().find('.js_textarea_count');
            $countInput.text(maxCount);
            $textarea.on('keyup', function () {
                var text = $textarea.val();
                var left = maxCount - text.length;
                if (left >= 0) {
                    $countInput.text(left);
                }
                $textarea.val(text.slice(0, maxCount));
            });
        });
    }

    function initActionFormEvents(parent, action) {
        $(parent).find('form').submit(function () {
            submitActionForm($(this), action);
            return false;
        });
    }

    function isFormValid($form) {
        var countErrors = 0;
        $form.find('.sezzle_error_msg_box').hide();
        $form.find('.sezzle_error_field').removeClass('sezzle_error_field');
        var maxAmount = $form.find('[name=maxAmount]').val();
        $form.find('[data-validation]').not(':disabled').each(function () {
            var currentError = 0;
            var $field = $(this);
            var rules = $field.data('validation').replace(/\s/, '').split(',');
            var value = $.trim($field.val());
            $.each(rules, function (i, rule) { // eslint-disable-line consistent-return
                switch (rule) {
                    case 'required':
                        if (!value.length) {
                            currentError++;
                        }
                        break;
                    case 'float':
                        if (isNaN(parseFloat(value)) || !isFinite(value)) {
                            currentError++;
                        }
                        break;
                    case 'greaterzero':
                        if (parseFloat(value) <= 0) {
                            currentError++;
                        }
                        break;
                    case 'max':
                        if (parseFloat(value) > maxAmount) {
                            currentError++;
                        }
                        break;
                    default:
                        break;
                }
                if (currentError) {
                    var name = $field.data('general-validation') || $field.attr('name');
                    $field.parents('tr').addClass('sezzle_error_field');
                    $form.find('.sezzle_error_msg_box_' + name + '_' + rule).show();
                    countErrors += currentError;
                    recalculateModalWindowSize();
                    return false;
                }
            });
        });
        return !!countErrors;
    }

    function showErrorMessage(text) {
        Ext.Msg.show({
            title: sezzleAdmin.resources.errorMsgTitle,
            msg: text,
            buttons: Ext.Msg.OK,
            icon: Ext.MessageBox.ERROR
        });
    }

    function submitCaptureForm($form, responseData) {
        $form.find('[name=methodName]').val('DoCapture');
        $form.find('[name=authorizationId]').val(responseData.transactionid);
        submitActionForm($form, 'capture');
    }

    function submitActionForm($form, action) {
        if (isFormValid($form)) return false;

        actionFormWindow.maskOver.show(action);
        $.ajax({
            url: $form.attr('action'),
            data: $form.serialize(),
            dataType: 'json',
            error: function () {
                actionFormWindow.maskOver.hide();
                transactionDetailWindow.close();
                actionFormWindow.close();
            },
            success: function (data) {
            	console.log(data);
                actionFormWindow.maskOver.hide();
                if (data.result == 'Success') {
                    actionFormWindow.close();
                    if (sezzleAdmin.currentOrderNo) {
                        loadOrderTransaction(sezzleAdmin.currentOrderNo, data.transactionid, sezzleAdmin.isCustomOrder, sezzleAdmin.currentCurrencyCode);
                    } else {
                        window.location.reload();
                    }
                } else if (data.l_longmessage0) {
                    showErrorMessage(data.l_longmessage0);
                } else {
                    showErrorMessage(sezzleAdmin.resources.serverError);
                }
            }
        });
        return true;
    }

    function initOrderTransaction() {
        sezzleAdmin.currentOrderNo = $('.js_sezzlebm_order_detail').data('orderno');
        sezzleAdmin.currentCurrencyCode = $('.js_sezzlebm_order_detail').data('currencycode');
        sezzleAdmin.isCustomOrder = $('.js_sezzlebm_order_detail').data('iscustom');
        $('.js_sezzle_action').on('click', function () {
            var $button = $(this);
            var action = $button.data('action');
            var $formContainer = $('#sezzle_' + action + '_form');
            var formContainerClass = 'js_sezzle_action_form_container_' + action;

            actionFormWindow = new Ext.Window({
                title: $button.data('title'),
                width: 700,
                modal: true,
                autoScroll: true,
                cls: 'sezzlebm_window_content ' + formContainerClass,
                listeners: {
                    render: function () {
                        actionFormWindow.body.insertHtml('afterBegin', $formContainer.html());
                        initTextareaCharectersLeft(actionFormWindow.body.dom);
                        initActionFormEvents(actionFormWindow.body.dom, action);
                    }
                },
                buttons: [
                    {
                        text: sezzleAdmin.resources.submit,
                        handler: function () {
                            submitActionForm($('.' + formContainerClass).find('form'), action);
                        }
                    },
                    {
                        text: sezzleAdmin.resources.cancel,
                        handler: function () {
                            actionFormWindow.close();
                        }
                    }
                ]
            });
            actionFormWindow.show();
            actionFormWindow.maskOver = createMaskOver(actionFormWindow);
        });

        $('.js_sezzlebm_order_transactions_ids').on('change', function () {
            var transactionId = $(this).val();
            loadOrderTransaction(sezzleAdmin.currentOrderNo, transactionId, sezzleAdmin.isCustomOrder, sezzleAdmin.currentCurrencyCode);
        });
    }

    function loadOrderTransaction(orderNo, transactionId, isCustom, currencyCode) {
        var data = {
            format: 'ajax',
            orderNo: orderNo || null,
            transactionId: transactionId || null,
            isCustomOrder: isCustom || null,
            currencyCode: currencyCode
        };
        transactionDetailWindow.maskOver.show();
        $.ajax({
            url: sezzleAdmin.urls.orderTransaction,
            data: data,
            error: function () { // eslint-disable-line no-shadow
                transactionDetailWindow.maskOver.hide();
                if (transactionDetailWindow) {
                    transactionDetailWindow.close();
                }
            },
            success: function (data) { // eslint-disable-line no-shadow
                transactionDetailWindow.maskOver.hide();
                if (transactionDetailWindow) {
                    $('#' + transactionDetailWindow.body.id).html(data);
                    transactionDetailWindow.setHeight('auto');
                    transactionDetailWindow.center();
                } else {
                    $('.js_sezzlebm_content').html(data);
                }
                initOrderTransaction();
            }
        });
    }

    function loadNewTransactionForm(url) {
        var data = {
            format: 'ajax'
        };
        transactionDetailWindow.maskOver.show();
        $.ajax({
            url: url,
            data: data,
            error: function () { // eslint-disable-line no-shadow
                transactionDetailWindow.maskOver.hide();
                if (transactionDetailWindow) {
                    transactionDetailWindow.close();
                }
            },
            success: function (data) { // eslint-disable-line no-shadow
                actionFormWindow = transactionDetailWindow;
                transactionDetailWindow.maskOver.hide();
                if (transactionDetailWindow) {
                    $('#' + transactionDetailWindow.body.id).html(data);
                    recalculateModalWindowSize();
                } else {
                    $('.js_sezzlebm_content').html(data);
                }
                toggleFields();
                shippingDisable();
                initTextareaCharectersLeft(transactionDetailWindow.body.dom);
                setChangeTypeHandler($('.js_sezzle_transaction_type'));
                referenceIdCheck($('#referenceInput'));
                initTotalAmountCount($('#totalAmount'), $('.totalCount'));
                $('.js_sezzle_new_transaction_currency_select').change(function () {
                    $('.js_paypa_currency').text($(this).val());
                });
            }
        });
    }

    function initTotalAmountCount($totalAmountField, $countedFields) {
        $countedFields.bind('input change', function () {
            var init = 0;

            $countedFields.each(function (pos, el) {
                var val = el.value.trim().length == 0 ? 0 : el.value;
                var err = isNaN(val) || !isFinite(val);
                init += err ? NaN : parseFloat(val);
            });

            if (!isNaN(init) || isFinite(init)) {
                $totalAmountField.html(init);
            } else {
                $totalAmountField.html('N/A');
            }
        });
    }

    function referenceIdCheck($referenceInput) {
        $referenceInput.bind('input change', function () {
            var method = $('input[name=methodName]').val() == 'DoReferenceTransaction';
            var enterValue = $.trim($(this).val());
            var reg = new RegExp('^B');
            var indexValue = !reg.test(enterValue) && !!enterValue[0];
            var $inputs = $('.js_sezzle_required_toggle input');
            if (method && indexValue) {
                $inputs.removeAttr('disabled');
            } else {
                $inputs.attr('disabled', 'disabled');
            }
        });
    }

    function submitNewTransactionForm($form) {
        if (isFormValid($form)) return false;
        var transactionAmt = parseFloat($form.find('input[name=itemamt]').val());
        var taxAmt = parseFloat($form.find('input[name=taxamt]').val());
        var shipingAmt = parseFloat($form.find('input[name=shippingamt]').val());
        var shippingFullName = $form.find('#shippingFirstName').val() + ' ' + $form.find('#shippingLastName').val();
        var amt = transactionAmt + taxAmt + shipingAmt;

        $form.find('input[name=shiptoName]').val(shippingFullName);
        $form.find('input[name=amt]').val(amt.toString());
        submitActionForm($form, '');
        return true;
    }

    function initEvents() {
        $('.js_sezzle_show_detail').on('click', function () {
            var $button = $(this);
            transactionDetailWindow = new Ext.Window({
                title: $button.attr('title'),
                width: 780,
                height: 200,
                modal: true,
                autoScroll: true,
                cls: 'sezzlebm_window_content'
            });
            transactionDetailWindow.show();
            transactionDetailWindow.maskOver = createMaskOver(transactionDetailWindow);
            loadOrderTransaction($button.data('orderno'), $button.data('transactionid'), $button.data('iscustom'), $button.data('currencycode'));
            return false;
        });

        $('.js_sezzle_create_reference_transaction').on('click', function () {
            var $button = $(this);
            sezzleAdmin.currentOrderNo = null;
            transactionDetailWindow = new Ext.Window({
                title: $button.attr('title'),
                width: 550,
                height: 200,
                modal: true,
                autoScroll: true,
                cls: 'sezzlebm_window_content',
                buttons: [{
                    text: sezzleAdmin.resources.submit,
                    handler: function () {
                        submitNewTransactionForm($('.sezzle_new_transaction_form'));
                    }
                }, {
                    text: sezzleAdmin.resources.cancel,
                    handler: function () {
                        transactionDetailWindow.close();
                    }
                }]
            });
            transactionDetailWindow.show();
            transactionDetailWindow.maskOver = createMaskOver(transactionDetailWindow);
            loadNewTransactionForm($button.data('url'));
            return false;
        });

        $('.js_sezzlebm_switch').on('click', function () {
            var blockId = $(this).attr('href');
            $('.js_sezzlebm_switch_block').hide();
            $(blockId).show();
            return false;
        });
    }

    function toggleFields() {
        $('.js_sezzle_toggle_button').on('click', function () {
            var $button = $(this);
            if ($button.data('hide')) {
                $button.text($button.data('text-show'));
                $button.data('hide', false);
            } else {
                $button.text($button.data('text-hide'));
                $button.data('hide', true);
            }
            $button.parent('div').find('table').toggle($button.data('hide'));
            recalculateModalWindowSize();
            return false;
        });
    }

    function shippingDisable() {
        $('.js_sezzle_disable_button').on('click', function () {
            var $button = $(this);
            var $shippingInputs = $('#shippingInfo').find(':input');
            var $shipingAmt = $('#shippingInfo input[name=shippingamt]');
            if ($button.data('disable')) {
                $('#shippingInfo tr').removeClass('sezzle_error_field');
                $button.text($button.data('text-enable'));
                $button.data('disable', false);
                $shippingInputs.attr('disabled', 'disabled');
                $shipingAmt.val('0');
            } else {
                $shippingInputs.removeAttr('disabled');
                $button.text($button.data('text-disable'));
                $button.data('disable', true);
            }
            return false;
        });
    }

    function recalculateModalWindowSize(el) {
        var modalWindow;
        if (typeof el == 'undefined') {
            $('.x-window').each(function () {
                recalculateModalWindowSize($(this).attr('id'));
            });
            return;
        }
        if (el.ctype == 'Ext.Component') {
            modalWindow = el;
        }
        if (el.jquery) {
            el = el.parents('.x-window').attr('id'); // eslint-disable-line no-param-reassign
        }
        if (typeof el == 'string') {
            modalWindow = Ext.getCmp(el);
        }
        var windowHeight = $window.height() - 30;
        modalWindow.setHeight('auto');
        var modalWindowHeight = modalWindow.getSize().height;
        if (modalWindowHeight > windowHeight) {
            modalWindow.setHeight(windowHeight);
        }
        modalWindow.center();
    }

    function setChangeTypeHandler($select) {
        var $billingAddress = $('.js_sezzle_billing_address');
        var $referenceInput = $('#referenceInput');
        var $recurringInput = $('#recurringInput');
        var $creditCard = $('.js_sezzle_credit_card');
        var $acctInput = $('#acctInput');
        var $orderOption = $('.sezzle_new_transaction_form option[value="Order"]');
        var $paymentType = $('.sezzle_new_transaction_form select[name=paymentAction]');
        var $method = $('.sezzle_new_transaction_form input[name=methodName]');
        var $countriesSelect = $('.sezzle_new_transaction_form select[name=countrycode]');
        var $requiredToggleInputs = $('.js_sezzle_required_toggle input');
        var status;

        $select.on('change', function () {
            if ($(this).find(':selected').val() != 'ba') {
                $('#paymentInfo tr').removeClass('sezzle_error_field');
                status = $('.js_sezzle_required_toggle').first().find('input').attr('disabled');
                $billingAddress.find('input').removeAttr('disabled');
                $billingAddress.show();
                $recurringInput.attr('disabled', 'disabled');
                $countriesSelect.attr('disabled', 'disabled');
                $countriesSelect.removeAttr('disabled');
                $referenceInput.attr('disabled', 'disabled').parents('tr').hide();
                $creditCard.find('input').removeAttr('disabled');
                $acctInput.show();
                $orderOption.attr('disabled', 'disabled');
                $method.val('DoDirectPayment');
                $requiredToggleInputs.attr('data-validation', 'required');
                if (!$paymentType.val()) {
                    $paymentType.find('option').first().attr('selected', 'selected');
                    $paymentType.find('option').last().removeAttr('selected');
                }
            } else {
                $('#paymentInfo tr').removeClass('sezzle_error_field');
                $requiredToggleInputs.data('validation', '');
                $billingAddress.find('input').attr('disabled', 'disabled');
                $billingAddress.hide();
                $recurringInput.removeAttr('disabled');
                $referenceInput.removeAttr('disabled', 'disabled').parents('tr').show();
                $countriesSelect.attr('disabled', 'disabled');
                $acctInput.hide();
                $orderOption.removeAttr('disabled');
                $requiredToggleInputs.removeAttr('data-validation');
                $method.val('DoReferenceTransaction');
                if (status != 'disabled') {
                    $acctInput.find('input').attr('disabled', 'disabled');
                } else {
                    $creditCard.find('input').attr('disabled', 'disabled');
                }
            }
            recalculateModalWindowSize();
        });
    }

    function createMaskOver(panel) {
        return (function () {
            return {
                ext: new Ext.LoadMask(panel.getEl()),
                show: function (type) {
                    this.ext.msg = sezzleAdmin.resources.loadMaskText[type] || sezzleAdmin.resources.pleaseWait;
                    this.ext.show();
                },
                hide: function () {
                    this.ext.hide();
                }
            };
        }());
    }

    return {
        init: function (config) {
            $.extend(this, config);
            $(document).ready(function () {
                initEvents();
                if ($('.js_sezzlebm_order_detail').size()) {
                    initOrderTransaction();
                }
            });
        }
    };
}(jQuery));
