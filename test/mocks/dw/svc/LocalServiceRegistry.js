var LocalServiceRegistry = function () {};

LocalServiceRegistry.createService = function (name, obj) {
    return function () {
        var reqObj = obj;
        reqObj.name = name;
        Object.assign(reqObj, this);
        this.object = reqObj;
        return this;
    };
};
module.exports = LocalServiceRegistry;
