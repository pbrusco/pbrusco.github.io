
/*
 * "Public" functions:
 *
 * - parse(string)    --> ast node
 * - pprint(ast node) --> string
 *
 * E.g.:
 *
 *    pprint(parse('let f x = \\y.x in f a b'))
 *    ~~> 'let f x y = x in f a b'
 *
 */

var MAX_SHOW_WIDTH = 50;

function is_whitespace(chr) {
    return chr == ' ' || chr == '\t' || chr == '\n' || chr == '\r';
}

function is_digit(chr) {
    return '0' <= chr && chr <= '9';
}

function is_alnum(chr) {
    return ('a' <= chr && chr <= 'z')
        || ('A' <= chr && chr <= 'Z')
        || ('0' <= chr && chr <= '9')
        || chr == '_'
        || chr == "'";
}

function forward_while(string, i, pred) {
    while (i < string.length && pred(string[i])) {
        i++;
    }
    return i;
}

function join(sep, list) {
    if (list.length == 0) {
        return '';
    }
    var res = list[0];
    for (var i = 1; i < list.length; i++) {
        res += sep + list[i];
    }
    return res;
}

// Dealing with strings and lines

function string_lines(string) {
    return string.split('\n');
}

function join_lines(lines) {
    return join('\n', lines);
}

function string_height(string) {
    var lines = string_lines(string);
    return lines.length;
}

function more_than_one_line(string) {
    return string.indexOf('\n') != -1;
}

function string_width(string) {
    var lines = string_lines(string);
    var width = 0;
    for (var i = 0; i < lines.length; i++) {
        width = Math.max(width, lines[i].length);
    }
    return width;
}

function indent(string) {
    var lines = string_lines(string);
    for (var i = 0; i < lines.length; i++) {
        lines[i] = '    ' + lines[i];
    }
    return join_lines(lines);
}

// Lexer + parser

function Token(type, value, area) {
    this.area = function () {
        return area;
    };
    this.type = function () {
        return type;
    };
    this.value = function () {
        return value;
    };
    this.description = function () {
        if (type == 'eof') {
            return 'end of file';
        } else {
            return '"' + value + '"';
        }
    };
    this.toString = function () {
        return '[token ' + type + ' "' + value + '" ' + area + ']';
    };
}

function Area(string, pos_start, pos_end) {
    this.toString = function () {
        return pos_start + '--' + pos_end;
    };
}

function ParseError(area, msg) {
    this.toString = function () {
        return msg;
    };
}

function tokenize(string) {
    var tokens = [];
    var yield = function(x) { tokens.push(x); };
    var i = 0;
    var reserved = {
        '(':      'lparen',
        ')':      'rparen',
        '.':      'sep',
        '=':      'eq',
        'let':    'let',
        'in':     'in',
        '\\':     'lambda',
        'fun':    'lambda',
    };
    while (i < string.length) {
        i = forward_while(string, i, is_whitespace);
        if (i >= string.length) {
            yield(new Token(
                'eof',
                'eof',
                new Area(string, string.length - 1, string.length)));
            break;
        }
        if (is_alnum(string[i])) {
            j = forward_while(string, i, is_alnum);
            var word = string.substring(i, j);
            var type;
            if (word in reserved) {
                type = reserved[word];
            } else {
                type = 'ident';
            }
            yield(new Token(type, word, new Area(string, i, j)));
            i = j;
        } else if (string[i] in reserved) {
            yield(new Token(
                reserved[string[i]], string[i],
                new Area(string, i, i + 1)));
            i += 1;
        } else {
            throw new ParseError(
                new Area(string, i, i + 1),
                'Unrecognized symbol: ' + string[i]);
        }
    }
    yield(new Token('eof', 'eof', string.length - 1, string.length));
    return tokens;
}

function Scanner(list) {
    var that = this;
    var i = 0;
    this.start = function () { i = 0; };
    this.current = function () {
        return list[i];
    };
    this.next = function () {
        i++;
    };
    this.at_end = function () {
        return i >= list.length;
    };
}

function Ast(type, children) {
    this.type = function () { return type; };
    this.children = function () { return children; };
    this.toString = function () {
        var total_width = type.length + 2;
        var split = false;
        var children_strings = [];
        for (var i = 0; i < children.length; i++) {
            var child_string = children[i].toString();
            children_strings.push(child_string);
            if (more_than_one_line(child_string)) {
                split = true;
            } else {
                total_width += string_width(child_string);
            }
        }
        split = split || (total_width >= MAX_SHOW_WIDTH);

        var sep;
        if (split) {
            sep = '\n'; 
        } else {
            sep = ' '; 
        }

        var res = '';
        res += '(' + type;
        for (var i = 0; i < children.length; i++) {
            var child_string = children_strings[i];
            if (split) {
                child_string = indent(child_string);
            }
            res += sep + child_string;
        }
        res += ')';
        return res;
    };
}

function token_from_id(id) {
    return new Token('ident', id, new Area('...', 0, 1));
}

function AstVar(name) {
    var ast = new Ast('var', [name]);
    ast.variable = function () { return name.value(); };
    return ast;
}

function AstLambda(name, body) {
    var ast = new Ast('lambda', [name, body]);
    ast.variable = function () { return name.value(); };
    ast.body = function () { return body; };
    return ast;
}

function AstLet(name, value, body) {
    var ast = new Ast('let', [name, value, body]);
    ast.variable = function () { return name.value(); };
    ast.value = function () { return value; };
    ast.body = function () { return body; };
    return ast;
}

function AstApp(fun, arg) {
    var ast = new Ast('app', [fun, arg]);
    ast.fun = function () { return fun; };
    ast.arg = function () { return arg; };
    return ast;
}

function parse_expect(scanner, expected_value, expected_type) {
    var tok = scanner.current();
    if (tok.type() != expected_type) {
        throw new ParseError(
            tok.area(),
            'Expected ' + expected_value + ', got: ' + tok.description());
    }
}

function parse_lambda(scanner) {
    scanner.next();
    var tok = scanner.current();
    parse_expect(scanner, 'an identifier', 'ident')
    var parameters = [];
    while (tok.type() == 'ident') {
        parameters.push(tok);
        scanner.next();
        tok = scanner.current();
    }
    parse_expect(scanner, '"."', 'sep')
    scanner.next();
    var res = parse_app(scanner);
    for (var i = parameters.length; i-- > 0;) {
        res = AstLambda(parameters[i], res);
    }
    return res;
}

function parse_let(scanner) {
    scanner.next();
    var tok = scanner.current();
    parse_expect(scanner, 'an identifier', 'ident')
    var identifiers = [];
    while (tok.type() == 'ident') {
        identifiers.push(tok);
        scanner.next();
        tok = scanner.current();
    }
    parse_expect(scanner, '"="', 'eq')
    scanner.next();
    var value = parse_app(scanner);
    for (var i = identifiers.length; i-- > 1;) {
        value = AstLambda(identifiers[i], value);
    }
    parse_expect(scanner, '"in"', 'in')
    scanner.next();
    var body = parse_app(scanner);
    return AstLet(identifiers[0], value, body);
}

function parse_expr(scanner) {
    var tok = scanner.current();
    if (tok.type() == 'ident') {
        var res = AstVar(tok);
        scanner.next()
        return res;
    } else if (tok.type() == 'lambda') {
        return parse_lambda(scanner);
    } else if (tok.type() == 'let') {
        return parse_let(scanner);
    } else if (tok.type() == 'lparen') {
        scanner.next();
        var res = parse_app(scanner);
        parse_expect(scanner, '")"', 'rparen')
        scanner.next();
        return res;
    } else {
        throw new ParseError(
            tok.area(),
            'Unexpected token: ' + tok.description());
    }
}

function is_right_delimiter(toktype) {
    return toktype == 'rparen'
        || toktype == 'eof'
        || toktype == 'in';
}

function parse_app(scanner) {
    var exprs = [];
    while (true) {
        var tok = scanner.current();
        if (is_right_delimiter(tok.type())) {
            break;
        }
        exprs.push(parse_expr(scanner));
    }
    if (exprs.length == 0) {
        throw new ParseError(scanner.current().area(), 'Empty application');
    }
    var res = exprs[0];
    for (var i = 1; i < exprs.length; i++) {
        res = AstApp(res, exprs[i]);
    }
    return res;
}

function parse(string) {
    return parse_app(new Scanner(tokenize(string)));
}

// Pretty-printer

function should_parenthesize(expr, is_last) {
    return (expr.type() == 'app')
        || (expr.type() == 'lambda' && !is_last)
        || (expr.type() == 'let' && !is_last);
}

function pprint_lambda(ast) {
    var body = ast;
    var parameters = [ast.variable()];
    body = body.body();
    while (body.type() == 'lambda') {
        parameters.push(body.variable());
        body = body.body();
    }
    return '\\' + join(' ', parameters) + '.' + pprint(body);
}

function pprint_let(ast) {
    var identifiers = [ast.variable()];
    var value = ast.value();
    var body = ast.body();
    while (value.type() == 'lambda') {
        identifiers.push(value.variable());
        value = value.body();
    }
    return 'let ' + join(' ', identifiers) + ' = ' +
            pprint(value) + ' in ' +
            pprint(body);
}

function pprint_app(ast) {
    var fun = ast;
    var exprs = [ast.arg()];
    fun = fun.fun();
    while (fun.type() == 'app') {
        exprs.unshift(fun.arg());
        fun = fun.fun();
    }
    exprs.unshift(fun);

    var total_width = 0;
    var arg_strings = [];
    var split = false;
    for (var i = 0; i < exprs.length; i++) {
        var arg_string = pprint(exprs[i]);
        if (should_parenthesize(exprs[i], i == exprs.length - 1)) {
            arg_string = '(' + arg_string + ')';
        }
        arg_strings.push(arg_string);
        if (more_than_one_line(arg_string)) {
            split = true;
        }
        total_width += string_width(arg_string);
    }

    split = split || (total_width >= MAX_SHOW_WIDTH);

    var sep;
    if (split) {
        sep = '\n'; 
    } else {
        sep = ' '; 
    }

    var res = arg_strings[0];
    for (var i = 1; i < arg_strings.length; i++) {
        var arg_string = arg_strings[i];
        if (split) {
            arg_string = indent(arg_string);
        }
        res += sep + arg_string;
    }
    return res;
}

function pprint(ast) {
    if (ast.type() == 'var') {
        return ast.variable();
    } else if (ast.type() == 'lambda') {
        return pprint_lambda(ast);
    } else if (ast.type() == 'let') {
        return pprint_let(ast);
    } else if (ast.type() == 'app') {
        return pprint_app(ast);
    } else {
        throw 'invalid AST node';
    }
}

function calculate_free_vars(ast) {
    // assumes ast is a well-formed term
    if (ast.type() == 'var') {
        var id = ast.variable();
        ast._fv = {};
        ast._fv[id] = 1;
        return ast._fv;
    } else if (ast.type() == 'lambda') {
        var id = ast.variable();
        var fv_body = calculate_free_vars(ast.body());
        ast._fv = {};
        for (var v in fv_body) {
            if (v == id) continue;
            ast._fv[v] = 1
        }
        return ast._fv;
    } else if (ast.type() == 'app') {
        var fv_fun = calculate_free_vars(ast.fun()); 
        var fv_arg = calculate_free_vars(ast.arg()); 
        ast._fv = {};
        for (var v in fv_fun) { ast._fv[v] = 1; }
        for (var v in fv_arg) { ast._fv[v] = 1; }
        return ast._fv;
    } else if (ast.type() == 'let') {
        var id = ast.variable();
        var fv_value = calculate_free_vars(ast.value()); 
        var fv_body = calculate_free_vars(ast.body()); 
        ast._fv = {}
        for (var v in fv_value) { ast._fv[v] = 1; }
        for (var v in fv_body) {
            if (ast._fv[v] == id) continue;
            ast._fv[v] = 1;
        }
        return ast._fv;
    } else {
        throw 'invalid AST node';
    }
}

function empty_intersection(d1, d2) {
    for (var key in d1) {
        if (key in d2) {
            return false;
        }
    }
    return true;
}

function strip_trailing_numbers(string) {
    var i = string.length - 1;
    while (is_digit(string[i]) && i > 0) {
        i--;
    }
    return string.substring(0, i + 1);
}

function fresh_id(id, forbidden_variables) {
    var i = 1;
    var base_id = strip_trailing_numbers(id);
    var id2 = base_id + i.toString();
    while (id2 in forbidden_variables) {
        i++;
        id2 = base_id + i.toString();
    }
    return id2;
}


function substitute_many(term, forbidden_variables, rename_map) {
    if (empty_intersection(term._fv, rename_map)) {
        return term;
    } else if (term.type() == 'var') {
        var id = term.variable();
        return rename_map[id];
    } else if (term.type() == 'app') {
        var fun2 = substitute_many(term.fun(), forbidden_variables, rename_map);
        var arg2 = substitute_many(term.arg(), forbidden_variables, rename_map);
        return AstApp(fun2, arg2);
    } else if (term.type() == 'lambda') {
        var id = term.variable();
        var id2, body2;
        if (id in forbidden_variables) {
            var id2 = token_from_id(fresh_id(id, forbidden_variables));
            forbidden_variables[id2] = 1;
            rename_map[id] = AstVar(id2);
            body2 = substitute_many(term.body(), forbidden_variables, rename_map);
            delete forbidden_variables[id2];
            delete rename_map[id];
        } else {
            id2 = token_from_id(id);
            body2 = substitute_many(term.body(), forbidden_variables, rename_map);
        }
        return AstLambda(id2, body2);
    } else {
        throw 'invalid AST node'
    }
}

function contract_beta_redex(term) {
    if (term.type() != 'app') return null;
    var fun = term.fun();
    var arg = term.arg();
    if (fun.type() != 'lambda') return null;

    calculate_free_vars(fun)
    var forbidden = calculate_free_vars(arg);
    var rename = {};
    rename[fun.variable()] = arg;
    return substitute_many(fun.body(), forbidden, rename);
}

