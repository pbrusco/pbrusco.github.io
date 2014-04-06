
function clear(elem_id) {
    var elem = document.getElementById(elem_id);
    elem.innerHTML = '';
}

function make_writer(elem_id) {
    return function (msg) {
        var elem = document.getElementById(elem_id);
        elem.innerHTML += msg + '<br>';
    };
}

var make_id = (function (id) {
    return function() { return id++; }
})(0);

function run(elem_id) {
    clear('debug');
    var elem = document.getElementById(elem_id);
    var out = make_writer('debug');
    try {
        var ast = parse(elem.value);
        out('<pre>' + pprint(ast) + '</pre>');
    } catch (exception) {
        out(exception);
    }
}

function LambdaButtonSoul(gui) {
    this.type = function () { return 'lambda'; }
    this.click = function (evt) {
        gui.set_current_tool('lambda');
    };
    this.caption = function (evt) { return 'λ'; }
    this.in_ports = function () { return []; };
    this.out_ports = function () { return []; };
}

function AppButtonSoul(gui) {
    this.type = function () { return 'app'; }
    this.click = function (evt) {
        gui.set_current_tool('app');
    };
    this.caption = function (evt) { return '@'; }
    this.in_ports = function () { return []; };
    this.out_ports = function () { return []; };
}

function VarButtonSoul(gui) {
    this.type = function () { return 'var'; }
    this.click = function (evt) {
        gui.set_current_tool('var');
    };
    this.caption = function (evt) { return 'x'; }
    this.in_ports = function () { return []; };
    this.out_ports = function () { return []; };
}

function PortButtonSoul(gui) {
    this.type = function () { return 'port'; }
    this.click = function (evt) {};
    this.caption = function (evt) { return ''; }
    this.in_ports = function () { return []; };
    this.out_ports = function () { return []; };
}

function VarNodeSoul(variable) {
    this.type = function () { return 'node_var'; }
    this.click = function (evt) {};
    this.caption = function (evt) { return variable; };
    this.in_ports = function () { return ['up']; };
    this.out_ports = function () { return []; }
}

function AppNodeSoul() {
    this.type = function () { return 'node_app'; }
    this.click = function (evt) {};
    this.caption = function (evt) { return '@'; };
    this.in_ports = function () { return ['up']; };
    this.out_ports = function () { return ['fun', 'arg']; }
}

function LambdaNodeSoul(variable) {
    this.type = function () { return 'node_lambda'; }
    this.click = function (evt) {};
    this.caption = function (evt) { return 'λ' + variable; };
    this.in_ports = function () { return ['up']; };
    this.out_ports = function () { return ['body']; }
}

function Connection(gui, port1, port2) {
    var that = this;
    var current_path = null;
    that.remove = function () {
        port1._connection = null;
        port2._connection = null;
        that.remove_path();
    };
    that.remove_path = function () {
        if (current_path != null) {
            current_path.remove();
        }
    };
    that.draw_path = function () {
        that.remove_path();
        var x1 = port1.attr('x') + port1.attr('width') / 2;
        var y1 = port1.attr('y') + port1.attr('height') / 2;;
        var x2 = port2.attr('x') + port2.attr('width') / 2;;
        var y2 = port2.attr('y') + port2.attr('height') / 2;;

        current_path = gui.draw_path('M' + x1 + " " + y1 + "L" + x2 + " " + y2);

        current_path._hover = function () {
            current_path.attr('stroke', gui.config.colors.edge_highlight);
            current_path.attr('stroke-width', gui.config.edge_width_highlight);
            gui.set_current_edge(that);
        };
        current_path._unhover = function () {
            current_path.attr('stroke', gui.config.colors.edge);
            current_path.attr('stroke-width', gui.config.edge_width);
            gui.set_current_edge(null);
        };
        current_path._unhover();
        current_path.hover(current_path._hover, current_path._unhover);
    };
    that.neighbour = function (port) {
        if (port == port1) {
            return port2;
        } else {
            return port1;
        }
    };
}

function opposite_port_type(port_type) {
    if (port_type == 'in') {
        return 'out';
    } else {
        return 'in';
    }
}

function cat(xs, ys) {
    var zs = [];
    for (var i = 0; i < xs.length; i++) { zs.push(xs[i]); }
    for (var i = 0; i < ys.length; i++) { zs.push(ys[i]); }
    return zs;
}

function _more_at_the_right(p0, p1, p2) {
    // return True if the line p0--p1 is more at the right
    // than the line p0--p2
    var x0 = p0[0]; var y0 = p0[1];
    var x1 = p1[0]; var y1 = p1[1];
    var x2 = p2[0]; var y2 = p2[1];
    return (x2 - x0) * (y1 - y0) <= (x1 - x0) * (y2 - y0);
}

function _point_compare(p, q) {
    if (p[0] < q[0] || (p[0] == q[0] && p[1] < q[1])) {
        return -1;
    } else if (p[0] == q[0] && p[1] == q[1]) {
        return 0;
    } else {
        return 1;
    }
}

function _point_is_elem(points, p) {
    for (var i = 0; i < points.length; i++) {
        if (points[i][0] == p[0] && points[i][1] == p[1]) {
            return true;
        }
    }
    return false;
}

function _nub(points) {
    var res = [];
    for (var i = 0; i < points.length; i++) {
        if (!_point_is_elem(res, points[i])) {
            res.push(points[i]);
        }
    }
    return res;
}

function _remove_point(points, p) {
    var res = [];
    for (var i = 0; i < points.length; i++) {
        if (points[i][0] == p[0] && points[i][1] == p[1]) continue;
        res.push(points[i]);
    }
    return res;
}

function convex_hull(points) {
    points = _nub(points);
    points.sort(_point_compare);
    var p0 = points[0];
    var hull = [p0];
    while (true) {
        var p = hull[hull.length - 1];
        var q = null;
        for (var i = 0; i < points.length; i++) {
            var q1 = points[i];
            if (q == null || _more_at_the_right(p, q1, q)) {
                q = q1;
            }
        }
        if (q == null || q == p0) { break; }
        hull.push(q);
        points = _remove_point(points, q);
    }
    return hull;
}

function connected_component(node, weak_strong) {
    var stack = [node];
    var result = [node];
    var reachable = {};
    reachable[node._id] = 1;
    while (stack.length > 0) {
        var current = stack.pop();
        for (var i = 0; i < current._ports.length; i++) {
            var port = current._ports[i]; 
            if (weak_strong == 'strong' && port._type == 'in') {
                continue;
            }
            if (port._connection == null) {
                continue;
            }
            var dst_port = port._connection.neighbour(port);
            var dst_node = dst_port._owner;
            if (!(dst_node._id in reachable)) {
                reachable[dst_node._id] = 1;
                stack.push(dst_node);
                result.push(dst_node);
            }
        }
    }
    return result;
}

function strongly_connected_component(node) {
    return connected_component(node, 'strong');
}

function reachable(weak_strong, node1, node2) {
    var cc = connected_component(node1, weak_strong);
    for (var i = 0; i < cc.length; i++) {
        if (node2._id == cc[i]._id) {
            return true;
        }
    }
    return false;
}

function strongly_reachable(node1, node2) {
    return reachable('strong', node1, node2);
}

function weakly_reachable(node1, node2) {
    return reachable('weak', node1, node2);
}

function node_vertices(node) {
    var m = 5;
    var x0 = node.attr('x');
    var y0 = node.attr('y');
    var x1 = x0 + node.attr('width');
    var y1 = y0 + node.attr('height');
    x0 -= m; y0 -= m;
    x1 += m; y1 += m;
    return [
        [x0, y0],
        [x0, y1],
        [x1, y0],
        [x1, y1],
    ];
}

function node_child(node, name) {
    if (!(name in node._ports_by_name)) {
        return null;
    }
    var port = node._ports_by_name[name];
    if (port._connection == null) {
        return null;
    }
    var dst_port = port._connection.neighbour(port);
    return dst_port._owner;
}

function node_is_term(node) {
    if (node._type == 'var') {
        return true;
    } else if (node._type == 'app') {
        var fun = node_child(node, 'fun');
        var arg = node_child(node, 'arg');
        if (fun == null) {
            return false;
        }
        if (arg == null) {
            return false;
        }
        return node_is_term(fun) && node_is_term(arg);
    } else if (node._type == 'lambda') {
        var body = node_child(node, 'body');
        if (body == null) {
            return false;
        }
        return node_is_term(body);
    } else {
        return false;
    }
}

function app_fun(node) { return node_child(node, 'fun') ; }
function app_arg(node) { return node_child(node, 'arg') ; }
function lambda_body(node) { return node_child(node, 'body') ; }

function GUI(config) {
    var that = this;
    var container = document.getElementById('gui');
    this.config = config;
    var paper = new Raphael(container,
                            config.width,
                            config.height);
    var current_tool = 'lambda';
    var current_node = null;
    var current_edge = null;
    var button_souls = {
        'lambda': new LambdaButtonSoul(that),
        'app': new AppButtonSoul(that),
        'var': new VarButtonSoul(that),
    };
    var control_buttons = {};

    this._mouse = {'x': 100, 'y': 100};
    this._current_ast_clipboard = null;
    this.init = function () {
        var background = paper.rect(0,
                                    0,
                                    config.width,
                                    config.height)
                            .attr('fill', config.background_color)
                            .click(function (evt) {
                                    that.unselect_ports();
                                    that.create_node(
                                        current_tool,
                                        that.current_variable_name(),
                                        evt.x - container.offsetLeft,
                                        evt.y - container.offsetTop
                                    );
                            });
        background.mousedown(function () { that.stop_moving(); });
        background.mouseup(function () {
            that.unselect_ports();
            that.stop_moving();
        });
        background.mousemove(function (evt) { that.do_move(evt.x, evt.y); });
        that._background = background;

        // control bar
        paper.rect(0,
                   0,
                   config.button_size + 2 * config.control_bar_padding,
                   config.height)
             .attr('fill', config.colors.control_bar);
        var i = 0;
        for (var k in button_souls) {
            var soul = button_souls[k];
            var x = config.control_bar_padding;
            var y = config.control_bar_padding +
                    i * (config.button_size + config.control_bar_padding);
            control_buttons[soul.type()] = that.make_button(
                    soul, soul.caption(), x, y, config.button_size, config.button_size);
            if (i == 0) {
                control_buttons[soul.type()]._press();
            }
            i++;
        }
    };

    this.make_button = function (soul, caption, x, y, w, h) {
        var button = paper.rect(x, y, w, h, config.button_roundedness);
        button._id = make_id();
        button._pressed = false;
        button._normal = function () { button.attr('fill', config.colors[soul.type()]); }
        button._highlight = function () { button.attr('fill', config.colors[soul.type() + '_highlight']); };
        button._hover = button._highlight;
        button._unhover = function () {
            if (!button._pressed) {
                button._normal();
            }
        };
        button._press = function () {
            button._pressed = true;
            button._highlight();
        };
        button._unpress = function () {
            button._pressed = false;
            button._normal();
        };

        button._normal();

        var button_caption = paper.text(x + w / 2, y + h / 2, caption);
        button_caption.attr('font-size', config.font_size);
        button_caption.attr('cursor', 'default');
        button._caption = button_caption;

        button._contents = [button, button_caption];

        button._onmouseover = function (fin, fout) {
            for (var i = 0; i < button._contents.length; i++) {
                button._contents[i].hover(fin, fout);
            }
        };
        button._onmousedown = function (fdown) {
            for (var i = 0; i < button._contents.length; i++) {
                button._contents[i].mousedown(fdown);
            }
        };
        button._onmousemove = function (fmove) {
            for (var i = 0; i < button._contents.length; i++) {
                button._contents[i].mousemove(fmove);
            }
        };
        button._onmouseup = function (fup) {
            for (var i = 0; i < button._contents.length; i++) {
                button._contents[i].mouseup(fup);
            }
        };
        button._onclick = function (fclick) {
            for (var i = 0; i < button._contents.length; i++) {
                button._contents[i].click(fclick);
            }
        };

        button._onmouseover(button._hover, button._unhover);
        button._onclick(soul.click);
        return button;
    };

    this.set_current_tool = function (tool) {
        control_buttons[current_tool]._unpress();
        current_tool = tool;
        control_buttons[current_tool]._press();
        if (tool == 'lambda' || tool == 'var') {
            that.input_focus('input_var');
        }
    };

    this.set_current_node = function (node) {
        current_node = node;
    };

    this.set_current_edge = function (edge) {
        current_edge = edge;
    };

    var currently_moving = null;
    var currently_moving_connected_component = false;
    var currently_moving_dx0 = 0;
    var currently_moving_dy0 = 0;
    this.start_moving = function (node, move_connected_component, x, y) {
        currently_moving = node;
        currently_moving_connected_component = move_connected_component;
        currently_moving_dx0 = currently_moving.attr('x') - x;
        currently_moving_dy0 = currently_moving.attr('y') - y;
    };
    this.move_node_delta = function (node, dx, dy) {
        for (var i = 0; i < node._contents.length; i++) {
            var elem = node._contents[i];
            elem.attr('x', elem.attr('x') + dx);
            elem.attr('y', elem.attr('y') + dy);
        }
        for (var i = 0; i < node._ports.length; i++) {
            var port = node._ports[i];
            if (port._connection != null) {
                port._connection.draw_path();
            }
        }
    };
    this.move_node_to = function (node, x, y) {
        that.move_node_delta(node, x - node.attr('x'), y - node.attr('y'));
    };
    this.do_move = function (x, y) {
        that._mouse.x = x - container.offsetLeft;
        that._mouse.y = y - container.offsetTop;
        if (currently_moving == null) return;
        var dx = x - currently_moving.attr('x') + currently_moving_dx0;
        var dy = y - currently_moving.attr('y') + currently_moving_dy0;
        var nodes = [];
        if (currently_moving_connected_component) {
            nodes = strongly_connected_component(currently_moving);
        } else {
            nodes = [currently_moving];
        }
        for (var i = 0; i < nodes.length; i++) {
            this.move_node_delta(nodes[i], dx, dy);
        }
    };
    this.stop_moving = function (node) {
        currently_moving = null;
    };

    var current_port = null;
    this.set_current_port = function (port) {
        if (current_port != null) {
            current_port._unpress();
        }
        current_port = port;
        if (current_port != null) {
            current_port._press();
        }
    }

    this.select_port = function (port) {
        if (current_port != null) {
            current_port._unpress()
            if (current_port._type == port._type) {
                that.set_current_port(port);
            } else {
                that.create_connection(current_port, port);
                that.set_current_port(null);
            }
        } else {
            that.set_current_port(port);
        }
    };

    this.unselect_ports = function () {
        if (current_port != null) {
            current_port._unpress();
            current_port = null;
        }
    };

    this.create_connection = function (port1, port2) {
        if (port1._type == 'out') {
            this.create_connection(port2, port1);
            return;
        }
        if (port1._type != 'in' || port2._type != 'out') {
            return;
        }

        if (weakly_reachable(port1._owner, port2._owner)) {
            return;
        }

        var conn = new Connection(that, port1, port2); 
        port1._connection = conn;
        port2._connection = conn;
        conn.draw_path();
    };

    this.remove_connection = function (conn) {
        conn.remove();
    };

    this.remove_node = function (node) {
        var contents = node._contents;
        for (var i = 0; i < node._ports.length; i++) {
            var port = node._ports[i];
            if (port._connection != null) {
                that.remove_connection(port._connection);
            }
        }
        for (var i = 0; i < contents.length; i++) {
            contents[i].remove();
        }
    };

    this.remove_edge = function (edge) {
        edge.remove();
    };

    this.remove_currently_selected_element = function (cc) {
        that.clear_redex_mark();
        if (current_node != null) {
            var nodes;
            if (cc) {
                that.copy_current_node();
                nodes = strongly_connected_component(current_node);
            } else {
                nodes = [current_node];
            }
            for (var i = 0; i < nodes.length; i++) {
                that.remove_node(nodes[i]);
            }
            that.set_current_node(null);
            return;
        }
        if (current_edge != null) {
            that.remove_edge(current_edge);
            that.set_current_edge(null);
            return;
        }
    };

    this.remove_subtree = function (node) {
        if (node == null) {
            return;
        } else if (node._type == 'var') {
            that.remove_node(node);
        } else if (node._type == 'app') {
            that.remove_subtree(app_fun(node));
            that.remove_subtree(app_arg(node));
            that.remove_node(node);
        } else if (node._type == 'lambda') {
            that.remove_subtree(lambda_body(node));
            that.remove_node(node);
        } else {
            throw 'Malformed node'
        }
    };

    var input_elements = ['input_var', 'input_term'];

    this.calculate_ast_width = function (ast) {
        if (ast.type() == 'var') {
            ast._width = config.button_size;
            return ast._width;
        } else if (ast.type() == 'lambda') {
            var body = ast.body();
            if (body != null) {
                ast._width = that.calculate_ast_width(ast.body());
            } else {
                ast._width = config.button_size;
            }
            return ast._width;
        } else if (ast.type() == 'app') {
            var fun = ast.fun();
            var arg = ast.arg();
            ast._width = 0;
            if (fun != null) {
                ast._width += that.calculate_ast_width(fun);
            }
            if (arg != null) {
                ast._width += that.calculate_ast_width(arg);
            }
            if (fun == null && arg == null) {
                ast._width += config.button_size;
            }
            if (fun != null && arg != null) {
                ast._width += config.button_size / 2;
            }
            return ast._width;
        } else if (ast.type() == 'let') {
            var value = ast.value();
            var body = ast.value();
            ast._width = 0;
            if (value != null) {
                ast._width += that.calculate_ast_width(value);
            }
            if (body != null) {
                ast._width += that.calculate_ast_width(body);
            }
            if (value == null && body == null) {
                ast._width += config.button_size;
            }
            if (value != null && body != null) {
                ast._width += config.button_size / 2;
            }
            return ast._width;
        } else {
            throw 'Malformed term';
        }
    };

    this.build_tree_from_ast = function (ast, x, y) {
        that.calculate_ast_width(ast);
        return that._build_tree_from_ast(ast, x, y);
    };

    this._build_tree_from_ast = function (ast, x, y) {
        // assuming ast ._width attribute is already precomputed
        if (ast.type() == 'var') {
            return that.create_node('var', ast.variable(), x, y);
        } else if (ast.type() == 'lambda') {
            var y1 = y + config.button_size + config.button_margin;
            var lambda_node = that.create_node('lambda', ast.variable(), x, y);
            var body = ast.body();
            if (body != null) {
                var body_node = that._build_tree_from_ast(ast.body(), x, y1);
                that.create_connection(
                    lambda_node._ports_by_name['body'],
                    body_node._ports_by_name['up']);
            }
            return lambda_node;
        } else if (ast.type() == 'app') {
            var y1 = y + config.button_size + config.button_margin;
            var w = ast._width / 4;
            var x1 = x - w;
            var x2 = x + w;
            var app_node = that.create_node('app', '', x, y);

            var fun = ast.fun();
            if (fun != null) {
                var fun_node = that._build_tree_from_ast(ast.fun(), x1, y1);
                that.create_connection(
                    app_node._ports_by_name['fun'],
                    fun_node._ports_by_name['up']);
            }
            var arg = ast.arg();
            if (arg != null) {
                var arg_node = that._build_tree_from_ast(ast.arg(), x2, y1);
                that.create_connection(
                    app_node._ports_by_name['arg'],
                    arg_node._ports_by_name['up']);
            }
            return app_node;
        } else {
            throw 'Malformed term';
        }
    };

    this.calculate_node_ast = function (node) {
        if (node._type == 'var') {
            node._ast = AstVar(token_from_id(node._variable));
        } else if (node._type == 'app') {
            var fun = node_child(node, 'fun');
            var arg = node_child(node, 'arg');
            if (fun != null) {
                fun = that.calculate_node_ast(fun);
            }
            if (arg != null) {
                arg = that.calculate_node_ast(arg);
            }
            node._ast = AstApp(fun, arg);
        } else if (node._type == 'lambda') {
            var body = node_child(node, 'body');
            if (body != null) {
                body = that.calculate_node_ast(body);
            }
            node._ast = AstLambda(token_from_id(node._variable), body);
        } else if (node._type == 'let') {
            var value = node_child(node, 'value');
            var body = node_child(node, 'body');
            if (value != null) {
                value = that.calculate_node_ast(value);
            }
            if (body != null) {
                body = that.calculate_node_ast(body);
            }
            node._ast = AstLet(token_from_id(node._variable), value, body);
        } else {
            throw 'Malformed term';
        }
        return node._ast;
    };

    this.calculate_node_width = function (node) {
        that.calculate_node_ast(node);
        that.calculate_ast_width(node._ast);
    };

    this.reindent_node_at = function (node, x, y) {
        // assuming node ._ast attribute is already precomputed
        that.move_node_to(node, x, y);
        if (node._type == 'var') {
            // pass
        } else if (node._type == 'app') {
            var fun = node_child(node, 'fun');
            var arg = node_child(node, 'arg');
            if (arg == null && fun == null) { return; }
            var y1 = y + config.button_size + config.button_margin;
            var xfun, xarg;
            if (arg != null && fun != null) {
                var w = node._ast._width / 4;
                xfun = x - w;
                xarg = x + w;
            } else {
                xfun = x;
                xarg = x;
            }
            if (fun != null) {
                that.reindent_node_at(fun, xfun, y1);
            }
            if (arg != null) {
                that.reindent_node_at(arg, xarg, y1);
            }
        } else if (node._type == 'lambda') {
            var body = node_child(node, 'body');
            if (body != null) {
                that.reindent_node_at(body, x, y + config.button_size + config.button_margin);
            }
        } else {
            throw 'Malformed term';
        }
    };

    this.reindent_current_node = function () {
        if (current_node == null) return;
        var node = current_node;
        that.calculate_node_width(node);
        that.reindent_node_at(node, node.attr('x'), node.attr('y'));
        that.redex_mark(node);
    };

    this.hide_error_message = function () {
        var elem = document.getElementById('error_message');
        elem.style.display = 'none';
        elem.innerHTML = '';
    };

    this.show_error_message = function (msg) {
        var elem = document.getElementById('error_message');
        elem.style.display = 'block';
        elem.innerHTML = msg;
    };

    this.start_input = function () {
        for (var i = 0; i < input_elements.length; i++) {
            var elem = document.getElementById(input_elements[i]);
            elem.style.fontSize = config.font_size + 'px';
            elem.style.border = 'none';
            elem.style.top = 0;
            elem.style.left = 0;
        }
        that.input_hide();
        that.input_focus('input_var');
        that.input_unfocus();

        // input term
        var elem = document.getElementById('input_term');
        elem.onkeyup = function (evt) {
            if (evt.keyCode != 13) return;
            try {
                var ast = parse(elem.value);
                that.build_tree_from_ast(ast, that._mouse.x, that._mouse.y);
            } catch (exception) {
                that.show_error_message(exception);
            }
        };
    };

    this.input_focus = function (elem_id) {
        that.input_hide();
        var elem = document.getElementById(elem_id + '_div');
        elem.style.visibility = 'visible';
        elem.style.display = 'block';
        elem = document.getElementById(elem_id);
        elem.focus();
        elem.select();
    };

    this.input_hide = function () {
        for (var i = 0; i < input_elements.length; i++) {
            var elem = document.getElementById(input_elements[i] + '_div');
            elem.style.visibility = 'hidden';
            elem.style.display = 'none';
        }
    };

    this.input_unfocus = function () {
        for (var i = 0; i < input_elements.length; i++) {
            var elem = document.getElementById(input_elements[i]);
            elem.blur();
        }
    };

    this.input_is_active = function () {
        for (var i = 0; i < input_elements.length; i++) {
            var elem = document.getElementById(input_elements[i]);
            if (document.activeElement == elem) {
                return true;
            }
        }
        return false;
    };

    this.current_variable_name = function () {
        var elem = document.getElementById('input_var');
        return elem.value;
    };

    this.set_variable_name = function (x) {
        var elem = document.getElementById('input_var');
        elem.value = x;
    };

    this.input_lambda_term = function () {
        that.input_focus('input_term');
    };

    this.copy_current_node = function () {
        if (current_node == null) return;
        //if (!node_is_term(current_node)) {
        //    that.show_error_message('Not a full term.');
        //}
        that._current_ast_clipboard = that.calculate_node_ast(current_node);
    };

    this.paste_current_clipboard = function () {
        if (that._current_ast_clipboard == null) return;
        that.build_tree_from_ast(that._current_ast_clipboard, that._mouse.x, that._mouse.y);
    };

    this.create_current_tool_node = function () {
        that.unselect_ports();
        that.create_node(
            current_tool,
            that.current_variable_name(),
            that._mouse.x,
            that._mouse.y
        );
    };

    this.contract_beta_redex = function (node) {
        var ast = that.calculate_node_ast(node);
        var ast2 = contract_beta_redex(ast);

        var up_port = node._ports_by_name['up'];
        var parent_port = null;
        if (up_port._connection != null) {
            parent_port = up_port._connection.neighbour(up_port);
        }

        var x = node.attr('x');
        var y = node.attr('y');
        that.remove_subtree(node);
        var node = that.build_tree_from_ast(ast2, x, y);
        that.create_connection(
            parent_port,
            node._ports_by_name['up']
        );
    };

    this.contract_current_redex = function () {
        if (current_node == null) {
            return;
        }

        if (!node_is_term(current_node)) {
            that.show_error_message('Tree is not a full term.');
            return;
        }
        var redex_nodes = that.check_for_redex(current_node);
        if (redex_nodes.length == 0) {
            that.show_error_message('No redex here.');
            return;
        }
        that.clear_redex_mark();
        that.contract_beta_redex(current_node);
        current_node = null;
    };

    this.dispatch_key = function (shift, keycode) {
        if (that.input_is_active()) {
            if (keycode == 13 /* Return */) { that.input_unfocus(); }
            if (keycode == 27 /* Esc */) { that.input_unfocus(); }
        } else {
            that.hide_error_message();
            var elem = document.getElementById('input_var'); elem.innerHTML = keycode;
            var chr = String.fromCharCode(keycode);
            //if (keycode == 13 /* Return */) { that.create_current_tool_node(); }
            if (keycode == 27 /* Esc */) { that.unselect_ports(); }
            if (keycode == 187 /* = */) { that.reindent_current_node(); }
            if (chr == 'A') { that.set_current_tool('app'); }
            if (chr == 'L') { that.set_current_tool('lambda'); }
            if (chr == 'X') { that.set_current_tool('var'); }
            if (chr == 'Y') { that.copy_current_node(); }
            if (chr == 'P') { that.paste_current_clipboard(); }
            if (chr == 'I') { that.input_lambda_term(); }
            if (chr == 'D') { that.remove_currently_selected_element(shift); }
            if (chr == 'R') { that.contract_current_redex(); }
        }
    };

    this.create_port = function (port_name, port_type, x, y, w, h) {
        var port = that.make_button(
            new PortButtonSoul(that), '', x, y, w, h);
        port._name = port_name;
        port._type = port_type;
        port._select = function () {
            that.select_port(port);
        };
        port.click(port._select);
        port._connection = null;
        return port;
    };

    this.check_for_redex = function (node) {
        if (node._type == 'app') {
            var fun_port = node._ports_by_name['fun'];
            if (fun_port._connection == null) return [];
            var up_port = fun_port._connection.neighbour(fun_port);
            if (up_port._name != 'up') return [];
            if (up_port._owner._type != 'lambda') return [];
            return [node, up_port._owner];
        } else {
            return [];
        }
    };

    var redex_mark = null;
    this.redex_mark = function (node) {
        that.clear_redex_mark();
        var redex_terms = that.check_for_redex(node);
        if (redex_terms.length == 0) return;

        var points = [];
        for (var i = 0; i < redex_terms.length; i++) {
            points = cat(points, node_vertices(redex_terms[i]));
        }
        var coords = convex_hull(points);
        var string_path = '';
        for (var i = 0; i < coords.length; i++) {
            var sep;
            if (i == 0) {
                sep = 'M';
            } else {
                sep = 'L';
            }
            string_path = string_path + sep + coords[i][0] + ' ' + coords[i][1];
        }
        string_path = string_path + 'Z';
        redex_mark = paper.path(string_path);
        redex_mark.attr('fill', config.colors.redex_mark);
        redex_mark.attr('stroke-width', 0);
        redex_mark.toBack();
        that._background.toBack();
    };

    this.clear_redex_mark = function (node) {
        if (redex_mark != null) {
            redex_mark.remove();
        }
    };

    this.create_node = function (node_type, variable_name, xx, yy) {
        var soul;
        if (node_type == 'var') { soul = new VarNodeSoul(variable_name); }
        if (node_type == 'app') { soul = new AppNodeSoul(); }
        if (node_type == 'lambda') { soul = new LambdaNodeSoul(variable_name); }
        var button = that.make_button(
                        soul,
                        soul.caption(),
                        xx,
                        yy,
                        config.button_size,
                        config.button_size);
        button._variable = variable_name;
        button._type = node_type;
        button._onmouseover(
            function () { that.set_current_node(button); },
            function () { that.set_current_node(null); }
        );
        button._onmouseover(
            function () { that.redex_mark(button); },
            function () { that.clear_redex_mark(); }
        );
        button._onmousedown(function (evt) {
            that.start_moving(button, evt.ctrlKey, evt.x, evt.y);
        });
        button._onmousemove(function (evt) {
            that.do_move(evt.x, evt.y);
        });
        button._onmouseup(function () {
            that.stop_moving();
        });

        button._ports = [];
        button._ports_by_name = {};

        for (var in_out = 0; in_out < 2; in_out++) {
            var ports, y0, port_type;
            if (in_out == 0) {
                ports = soul.in_ports();
                y0 = button.attr('y') - config.port_size / 2;
                port_type = 'in';
            } else {
                ports = soul.out_ports();
                y0 = button.attr('y') + config.button_size - config.port_size / 2;
                port_type = 'out';
            }
            for (var i = 0; i < ports.length; i++) {
                var port_name = ports[i];
                var port = that.create_port(
                    port_name,
                    port_type,
                    button.attr('x') + i * config.port_size,
                    y0,
                    config.port_size,
                    config.port_size);
                port._owner = button;
                button._contents.push(port);
                button._ports.push(port);
                button._ports_by_name[port_name] = port;
            }
        }

        button._onclick(function () {
            // select the most apt port
            if (current_port != null && current_port._owner == button) {
                return;
            }
            var look_for;
            if (current_port == null) {
                look_for = 'out';
            } else {
                look_for = opposite_port_type(current_port._type);
            }
            for (var j = 0; j < 2; j++) {
                for (var i = 0; i < button._ports.length; i++) {
                    var port = button._ports[i];
                    if (port._type == look_for && port._connection == null) {
                        port._select();
                        return;
                    }
                }
                // if not found, look for any other port
                look_for = opposite_port_type(look_for);
            }
        });
        return button;
    };

    that.draw_path = function (path_string) {
        return paper.path(path_string);
    };
}

var SCALE = 1;
var CONFIG = {
    //'width': 1366 + 10, 'height': 768 + 10,
    //'width': 1000 + 10, 'height': 500 + 10,
    'width': 3000, 'height': 1500,
    'background_color': '#ffffff',
    'font_size': SCALE * 18,
    'button_size': SCALE * 36,
    'button_margin': SCALE * 5,
    'port_size': SCALE * 12,
    'button_roundedness': SCALE * 8,
    'control_bar_padding': SCALE * 5,
    'edge_width': SCALE * 4,
    'edge_width_highlight': SCALE * 8,
    'colors': {
        'control_bar': '#ffffff',

        'edge': '#202020', 'edge_highlight': '#808080',

        'var': '#a0a0a0', 'var_highlight': '#f0f040',
        'node_var': '#f0f0a0', 'node_var_highlight': '#f0f0f0',

        'app': '#a0a0a0', 'app_highlight': '#f04040',
        'node_app': '#f0a0a0', 'node_app_highlight': '#f0f0f0',

        'lambda': '#a0a0a0', 'lambda_highlight': '#4040f0',
        'node_lambda': '#a0a0f0', 'node_lambda_highlight': '#f0f0f0',

        'port': '#404040', 'port_highlight': '#ffffff',
        'redex_mark': '#a0f0a0',
    },
};

function init_gui() {
    var gui = new GUI(CONFIG);
    gui.init();
    gui.start_input();
    document.onkeyup = function (evt) {
        gui.dispatch_key(evt.shiftKey, evt.keyCode);
    };
}

