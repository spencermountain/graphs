(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(_dereq_,module,exports){
"use strict";

function _templateObject() {
  var data = _taggedTemplateLiteral(["<a href=\"", "\" class=\"left flex-start w30 m2\" >\n    <span class=\"m3 olive\" >", "</span>\n    <span class=\"link\">", "</span>\n    <img class=\"block\" style=\"margin-left:95px; max-width:450px; max-height:100px;\" src=\"", "\" />\n  </a>\n  "]);

  _templateObject = function _templateObject() {
    return data;
  };

  return data;
}

function _taggedTemplateLiteral(strings, raw) { if (!raw) { raw = strings.slice(0); } return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); }

var htm = _dereq_('htm');

var h = htm.bind(_dereq_('vhtml'));

var manifest = _dereq_('./manifest');

var el = document.querySelector('#stage');
var pages = manifest.map(function (o) {
  return h(_templateObject(), o.path, o.path, o.title, o.path + '/' + o.thumb);
});
el.innerHTML = pages.join(' ');

},{"./manifest":2,"htm":3,"vhtml":4}],2:[function(_dereq_,module,exports){
"use strict";

module.exports = [{
  path: '2018/01',
  title: 'north american sports seasons by city',
  thumb: 'thumb.png'
}, {
  path: '2018/02',
  title: 'temperature by latitude',
  thumb: 'thumb.png'
}];

},{}],3:[function(_dereq_,module,exports){
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):e.htm=t()}(this,function(){var e={},t=document.createElement("template"),n=/(\$_h\[\d+\])/g;function r(e,t){var r=e.match(n),i=JSON.stringify(e);if(null!=r){if(r[0]===e)return e;i=i.replace(n,'"'+t+"$1"+t+'"').replace(/"[+,]"/g,""),","==t&&(i="["+i+"]")}return i}return function(n){return(e[n]||(e[n]=function(e){for(var n=e[0],i=1;i<e.length;)n+="$_h["+i+"]"+e[i++];return t.innerHTML=n.replace(/<(?:(\/)\/|(\/?)(\$_h\[\d+\]))/g,"<$1$2c c@=$3").replace(/<([\w:-]+)(?:\s[^<>]*?)?(\/?)>/g,function(e,t,n){return e.replace(/(?:'.*?'|".*?"|([A-Z]))/g,function(e,t){return t?":::"+t:e})+(n?"</"+t+">":"")}).trim(),Function("h","$_h","return "+function e(t){if(1!=t.nodeType)return 3==t.nodeType&&t.data?r(t.data,","):"null";for(var n="",i=r(t.localName,n),u="",a=",({",o=0;o<t.attributes.length;o++){var c=t.attributes[o].name,f=t.attributes[o].value;"c@"==c?i=f:"..."==c.substring(0,3)?(u="",a=",Object.assign({",n+="},"+c.substring(3)+",{"):(n+=u+'"'+c.replace(/:::(\w)/g,function(e,t){return t.toUpperCase()})+'":'+(!f||r(f,"+")),u=",")}n="h("+i+a+n+"})";for(var l=t.firstChild;l;)n+=","+e(l),l=l.nextSibling;return n+")"}((t.content||t).firstChild))}(n)))(this,arguments)}});

},{}],4:[function(_dereq_,module,exports){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.vhtml = factory());
}(this, (function () { 'use strict';

var emptyTags = ['area', 'base', 'br', 'col', 'command', 'embed', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track', 'wbr'];

var esc = function esc(str) {
	return String(str).replace(/[&<>"']/g, function (s) {
		return '&' + map[s] + ';';
	});
};
var map = { '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' };

var sanitized = {};

function h(name, attrs) {
	var stack = [];
	for (var i = arguments.length; i-- > 2;) {
		stack.push(arguments[i]);
	}

	if (typeof name === 'function') {
		(attrs || (attrs = {})).children = stack.reverse();
		return name(attrs);
	}

	var s = '<' + name;
	if (attrs) for (var _i in attrs) {
		if (attrs[_i] !== false && attrs[_i] != null) {
			s += ' ' + esc(_i) + '="' + esc(attrs[_i]) + '"';
		}
	}

	if (emptyTags.indexOf(name) === -1) {
		s += '>';

		while (stack.length) {
			var child = stack.pop();
			if (child) {
				if (child.pop) {
					for (var _i2 = child.length; _i2--;) {
						stack.push(child[_i2]);
					}
				} else {
					s += sanitized[child] === true ? child : esc(child);
				}
			}
		}

		s += '</' + name + '>';
	} else {
		s += '>';
	}

	sanitized[s] = true;
	return s;
}

return h;

})));


},{}]},{},[1]);
