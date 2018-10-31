import { Component } from '../component';
import GLOBALS from '../consts/GLOBALS';
import { Listener } from '../store';
import { flatten } from '../utils';
import { mount } from '../mount';
import { setProps } from '../html';

/**
 * @param {HTMLElement|HTMLElement[]} node
 * @param {HTMLElement} $parent
 * @returns {HTMLElement|HTMLElement[]}
 */
export function render(node, $parent) {
  if (Array.isArray(node)) {
    const output = flatten(node).map(n => render(n, $parent));

    // Always must render some element
    // In case of empty array we simulate empty element as null
    if (output.length === 0) return render([null], $parent);

    return output;
  }

  if (node && node.__esModule && node.default) {
    return render(node.default, $parent);
  }

  if ((node && typeof node.type === 'function') || typeof node === 'function') {
    const componentFn = node.type || node;
    const compNode = new Component(componentFn, node.props, node.children);
    const tempComponent = GLOBALS.CURRENT_COMPONENT;
    GLOBALS.CURRENT_COMPONENT = compNode;
    const renderedComponent = compNode.render(node.props, node.children, $parent);

    let $styleRef;

    if (renderedComponent && typeof renderedComponent.addEventListener === 'function') {
      renderedComponent.addEventListener('mount', () => {
        if (typeof compNode.style === 'string') {
          $styleRef = document.createElement('style');
          $styleRef.innerHTML = compNode.style;
          document.head.appendChild($styleRef);
        }
        compNode.trigger('mount', renderedComponent);
      }, {
        passive: true,
        once: true,
      }, false);

      renderedComponent.addEventListener('destroy', () => {
        compNode.trigger('destroy', renderedComponent);
        if ($styleRef instanceof Node) {
          document.head.removeChild($styleRef);
        }
      }, {
        passive: true,
        once: true,
      }, false);
    }

    if (Array.isArray(renderedComponent)) {
      renderedComponent.forEach((compItem) => {
        if (compItem && typeof compItem.addEventListener === 'function') {
          compItem.addEventListener('mount', () => {
            if (typeof compNode.style === 'string') {
              $styleRef = document.createElement('style');
              $styleRef.innerHTML = compNode.style;
              document.head.appendChild($styleRef);
            }
            compNode.trigger('mount', compItem);
          }, {
            passive: true,
            once: true,
          }, false);

          compItem.addEventListener('destroy', () => {
            compNode.trigger('destroy', compItem);
            if ($styleRef instanceof Node) {
              document.head.removeChild($styleRef);
            }
          }, {
            passive: true,
            once: true,
          }, false);
        }
      });
    }

    function refFactory(data, ii) {
      if (ii && Array.isArray(compNode.dom)) {
        return compNode.dom[ii] = data;
      }
      return compNode.dom = data;
    }

    if (Array.isArray(renderedComponent)) {
      renderedComponent[0].__radiRef = refFactory;
    } else {
      renderedComponent.__radiRef = refFactory;
    }
    GLOBALS.CURRENT_COMPONENT = tempComponent;

    return renderedComponent;
  }

  if (node instanceof Node) {
    return node;
  }

  if (node instanceof Listener) {
    return node.render();
  }

  if (node instanceof Promise) {
    return render({ type: 'await', props: { src: node }, children: [] }, $parent);
  }

  // if the node is text, return text node
  if (['string', 'number'].indexOf(typeof node) > -1) { return document.createTextNode(node); }

  // We still have to render nodes that are hidden, to preserve
  // node tree and ref to components
  if (!node) {
    return document.createComment('');
  }

  if (!(
    typeof node.type !== 'undefined'
    && typeof node.props !== 'undefined'
    && typeof node.children !== 'undefined'
  )) {
    return document.createTextNode(JSON.stringify(node));
  }

  if (typeof GLOBALS.CUSTOM_TAGS[node.type] !== 'undefined') {
    return render({
      ...node,
      type: GLOBALS.CUSTOM_TAGS[node.type].render,
    }, $parent);
  }

  // create element
  let element;
  if (node.type === 'svg' || $parent instanceof SVGElement) {
    element = document.createElementNS(
      'http://www.w3.org/2000/svg',
      node.type
    );
  } else {
    element = document.createElement(node.type);
  }

  // set attributes
  setProps(element, node.props);

  // build and append children
  if (node.children) {
    flatten(node.children || []).forEach(child => {
      const childNode = child instanceof Node ? child : render(child, element);
      mount(childNode, element);
    });
  }

  return element;
}
