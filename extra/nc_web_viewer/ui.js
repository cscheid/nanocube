/*global React */
ui = (function() {
    var Button = React.createClass({
        render: function() {
            return React.createElement("input", {
                type: "button",
                value: this.props.text,
                onClick: this.props.click
            });
        }
    });
    
    var Text = React.createClass({
        render: function() {
            return React.createElement("span", { className: "ui" }, this.props.text);
        }
    });

    var Table = React.createClass({
        render: function() {
            var lines = [];
            for (var i=0; i<this.props.values.length; ++i) {
                var line = [];
                for (var j=0; j<this.props.values[i].length; ++j) {
                    line.push(React.createElement("td", { className: "ui" }, this.props.values[i][j]));
                }
                line.unshift("tr", {className: "ui"});
                lines.push(React.createElement.apply(null, line));
            }
            lines.unshift("tbody", {className: "ui"});
            return React.createElement("table", {className: "ui"}, React.createElement.apply(null, lines));
        }
    });

    var CheckBox = React.createClass({
        handleChange: function(event) {
            this.props.change(event.target.checked);
            ui.update();
        },
        render: function() {
            var that = this;
            return React.createElement(
                "div", { className: "ui" },
                React.createElement(
                    "label", { className: "ui" },
                    React.createElement("input", {
                        type: "checkbox",
                        onChange: this.handleChange,
                        checked: this.props.checked,
                        value: ""
                    }), this.props.label));
        }
    });

    var IncDecButtonGroup = React.createClass({
        render: function() {
            return React.createElement(
                "div", { className: "ui" },
                React.createElement(Button, {
                    text: "-",
                    click: this.props.decrease
                }),
                React.createElement(Button, {
                    text: "+",
                    click: this.props.increase
                }),
                React.createElement("span",
                                    { style: { paddingLeft: "5px" } },
                                    this.props.label));
        }
    });

    var Hr = React.createClass({
        render: function() { return React.createElement("hr", {}); }
    });

    var els = [];

    var StateCell = React.createClass({
        componentDidMount: function() {
            if (this.props.watchers) {
                var s = this.props.state;
                this.props.watchers.forEach(function(w) { w(s); });
            }
        },
        componentWillReceiveProps: function(nextProps) {
            if (this.props.watchers &&
                this.props.state !== nextProps.state) {
                var s = nextProps.state;
                this.props.watchers.forEach(function(w) { w(s); });
            }
        },
        render: function() { return null; }
    });

    function _isReactObject(o) {
        return _.isObject(o) && (!_.isUndefined(o.$$typeof));
    }
    
    var ui = {
        state: function(obj) { return React.createElement(StateCell, obj); },
        button: function(obj) { return React.createElement(Button, obj); },
        checkBox: function(obj) { return React.createElement(CheckBox, obj); },
        incDecButtons: function(obj) { return React.createElement(IncDecButtonGroup, obj); },
        div: function() {
            var params = _.toArray(arguments);
            params.unshift("div");
            params[0] = _.defaults(params[0], {
                className: "ui"
            });
            return React.createElement.apply(null, params);
        },
        group: function() {
            var params = _.toArray(arguments);
            params.unshift("div", { className: "ui" });
            return React.createElement.apply(null, params);
        },
        panel: function() {
            var params = _.toArray(arguments);
            if (!_isReactObject(params[0])) {
                // then we assume it's an options parameter
                params[0] = _.clone(params[0]);
                params[0].className = (params[0].className || "") + " ui panel";
            } else {
                // if it's a react object, then we need to add the options object ourselves.
                params.unshift({ className: "ui panel" });
            }
            params.unshift("div");
            return React.createElement.apply(null, params);
        },
        text: function(text) {
            return React.createElement(Text, { text: text });
        },
        hr: function() { return React.createElement(Hr, {}); },
        table: function(v) {
            return React.createElement(Table, { values: v });
        },

        //////////////////////////////////////////////////////////////////////
        
        add: function(renderfun, dom_element) {
            els.push([renderfun, dom_element]);
            ui.update();
        },

        update: function() {
            _.each(els, function(el) {
                ReactDOM.render(el[0](), el[1]);
            });
        },
        key: function(dict) {
            return function() {
                var e = d3.event;
                var code = e.keyCode || e.which;
                if (e.which == 13) {
                    e.preventDefault();
                }
                var callback = dict[String.fromCharCode(code)] ||
                        dict[code];
                if (_.isUndefined(callback))
                    return;
                callback(e);
            };
        }
    };
    return ui;
})();
