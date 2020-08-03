
/**
 * Library for providing access to DW site preferences and resources
 *
 * @param {dw.svc} svc Svc
 * @param {Object} client Client
 * @returns {Object} Data instance
 */
function responseParser(svc, client) {
    var response;
    switch (client.statusCode) {
        case 200:
            response = {
                error: false,
                response: JSON.parse(client.text)
            };
            break;
        case 400:
        case 401:
        case 404:
            response = {
                error: true,
                response: JSON.parse(client.text)
            };
            break;
        default:
            break;
    }
    return response;
}

module.exports = {
    	responseParser: responseParser
};
