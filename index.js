if (typeof Object.prototype.clone === "undefined") {
    Object.prototype.clone = function clone(obj) {
        //in case of premitives
        if (obj === null || typeof obj !== "object") {
            return obj;
        }

        //date objects should be 
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }

        //handle Array
        if (Array.isArray(obj)) {
            var clonedArr = [];
            obj.forEach(function (element) {
                clonedArr.push(clone(element))
            });
            return clonedArr;
        }

        //lastly, handle objects
        let clonedObj = new obj.constructor();
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                clonedObj[prop] = clone(obj[prop]);
            }
        }
        return clonedObj;
    };
}

Events = {
    publish: function publishEvent(event, args) {
        if (!(event instanceof Event)) {
            event = new CustomEvent(event, { detail: args });
        }
        window.dispatchEvent(event);
    },
    on: function subscribeEvent(name, handler) {
        window.addEventListener(name, handler);
        return () => this.un(name, handler);
    },
    un: function unsubscribeEvent(name, handler) {
        window.removeEventListener(name, handler);
    }
};

class HttpResponse {
    constructor(xhr) {
        this.response = xhr.responseText;
        this.status = xhr.status;
    }
}
class HttpRequest {
    constructor(options) {
        this.options = options;
    }

    execute(resolve, reject) {
        console.log("EXEC?")
        var xhr = new XMLHttpRequest();
        xhr.open(this.options.method || 'GET', this.options.url);
        xhr.send(this.options.parameters);
        xhr.onreadystatechange = function () {
            var DONE = 4; // readyState 4 means the request is done.
            var OK = 200; // status 200 is a successful return.
            var response = new HttpResponse(xhr);
            if (xhr.readyState === DONE) {

                if (xhr.status === OK) {
                    resolve(response);
                } else {
                    reject(response);
                }
            }
        }
    }
}
class HttpClient {


    execute(options) {
        if (!options || !options.url) {
            throw new Error("At least options object with url property must be specified");
        }

        var request = new HttpRequest(options);
        var promise = new Promise((resolve, reject) => request.execute(resolve, reject));
        return promise;
    }
}



class Zone {
    constructor(element) {
        this.element = element;
        this.name = this.element.getAttribute("data-area");
        this.host = element.parentNode;
        this.waitingElement = document.createElement("div");
        this.waitingElement.innerHTML = "<i class='fa fa-3x fa-spin fa-refresh'></i>";
        this.waitingElement.style.display = 'none';

        Events.on("Simple.RouteChanging", e => this.indicateWaiting());
        Events.on("Simple.RouteChanged", e => this.load(e.detail));
        Events.on("Simple.RouteChangeCancelled", a => console.log("C", a));
    }

    indicateWaiting() {
        this.waitingElement.style.display = '';
        this.element.style.visibility = 'hidden';
    }

    onContentLoaded(httpResponse) {

        this.element.innerHTML = httpResponse.response;
        this.waitingElement.style.display = 'none';
        this.element.style.visibility = 'visible';

        console.log("SUCCSSS RESPONSE: ", httpResponse);
    }
    load(route) {
        var template = route.areas[this.name];
        if (template) {
            if (template.indexOf(".html") < 0) {
                template += ".html";
            }
            var client = new HttpClient();

            client.execute({ url: template }).then(r => this.onContentLoaded(r),
                function (httpResponse) {
                    console.log("ERROR RESPONSE: ", httpResponse);
                });
        }
    }
}

class UiComponent {
    constructor(host) {
        this.host = host;

        Events.on("Simple.DataSourceAssigned", ds => this.dataSource = ds);

        Events.on("Simple.RefreshRequested", () => this.load());
    }

    load() {
        if (this.dataSource) {
            this.dataSource.query(this.parameters || {}).then(r => this.onContentAvailable(r));
        }
    }

    onContentAvailable(content) {
        this.bind(content);
    }

    bind(content) {

    }


}

class App {
    start(options) {
        this.areas = [];
        this.router = new Router(options.root);

        for (let area of options.areas) {
            const areaElementSelector = `[data-area='${area}']`;
            const element = document.querySelector(areaElementSelector);
            this.areas.push(new Zone(element));
        }

    }
}
class RouteChangingEvent extends CustomEvent {
    constructor(args) {
        super("Simple.RouteChanging", { detail: args, cancelable: true });


    }
}

class DataSource {
    constructor(name) {
        this.name = name;
    }
}

class HttpDataSource extends DataSource {
    constructor(name, options) {
        super(name);
        this.options = options;
    }

    query(parameters) {
        
        const client = new HttpClient();

        const requestParameters = this.transformParameters(parameters || {});
        const httpOptions = Object.assign({}, this.options);
        httpOptions.parameters = requestParameters;

        return client.execute(httpOptions).then(r=>this.transformResponse(r.response));
    }

    transformParameters(parameters) {
        return clone(parameters);
    }
    transformResponse(response) {
        return response;
    }
}
class JsonHttpRemoteDataSource extends HttpDataSource {
    constructor(name, options) {
        super(name, options);
    }

    transformResponse(response) {
        return JSON.parse(response);
    }
}
class RouteChangedEvent extends CustomEvent {
    constructor(args) {
        super("Simple.RouteChanged", { detail: args });
    }
}
class RouteChangeCancelledEvent extends CustomEvent {
    constructor(args) {
        super("Simple.RouteChangeCancelled", { detail: args });
    }
}
class Router {

    constructor(root, routes) {
        this.routes = routes || {};
        this.root = (typeof root === "string") ? { "Name": root } : root;
        location.href = "#/" + (root.Url || root.Name);

        window.addEventListener('popstate', () => this.popstate());
    }
    register(route) {
        this.routes[route.Url] = route;
    }
    popstate() {
        var to = location.hash.replace("#/", '');
        var routeChangingEvent = new RouteChangingEvent({
            to: to

        });

        Events.publish(routeChangingEvent);

        if (!routeChangingEvent.defaultPrevented) {
            var route = this.routes[to] || this.root;
            
            var routeChangedEvent = new RouteChangedEvent(route);

            Events.publish(routeChangedEvent);
        } else {
            Events.publish(new RouteChangeCancelledEvent({ to: to }));
        }
    }
}

var app = new App();
app.start({
    root: {
        "Name": "home",
        areas: {
            "content": "home",
            "header": "header",
            "footer": "footer"
        }
    },
    areas: ["content", "header", "footer"]
});