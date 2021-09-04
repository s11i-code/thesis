/* eslint-disable @typescript-eslint/no-unused-vars */

// RANDOM STUFF
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
}

export function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// SHARED DOM STUFF

// function getRandomDescendent(startElement: HTMLElement): HTMLElement {
//   // get a random descendent that has no visible children
//   let currentEl = startElement;
//   while (currentEl.childElementCount > 0) {
//     const childIdx = getRandomInt(0, currentEl.childElementCount - 1);
//     currentEl = currentEl.children[childIdx] as HTMLElement;
//   }
//   return currentEl;
// }

function getRandomDescendent(startElement: HTMLElement): HTMLElement | undefined {
  // get a random leaf node or undefined if no child is visible
  let randDescendent = startElement;

  while (randDescendent && randDescendent.childElementCount > 0) {
    const visibleChildren = Array.from(randDescendent.children).filter((child) => elementIsVisible(child as HTMLElement));
    const childIdx = getRandomInt(0, visibleChildren.length - 1);
    randDescendent = visibleChildren[childIdx] as HTMLElement;
  }
  return randDescendent;
}

function fixDimensions(element: HTMLElement, rect: DOMRect): void {
  element.style["max-width"] = `${rect.width}px`;
  element.style["width"] = `${rect.width}px`;
  element.style["max-height"] = `${rect.height}px`;
  element.style["height"] = `${rect.height}px`;
}

function elementIsVisible(element: HTMLElement): boolean {
  // todo: check these techniques: https://webaim.org/techniques/css/invisiblecontent
  const takesSpace = [element.offsetWidth, element.offsetHeight].every((offset) => offset > 0);
  const { display, visibility, opacity, clip } = window.getComputedStyle(element);
  const visible = takesSpace && visibility !== "hidden" && display !== "none" && opacity !== "0" && clip !== "rect(1px, 1px, 1px, 1px)";

  if (!visible) {
    return false;
  }
  return true;
}

function isVisibleInDOM(startElement: HTMLElement): boolean {
  let element = startElement;
  while (element && !element.tagName.match(/body/i)) {
    if (!elementIsVisible(element)) {
      return false;
    }
    element = element.parentElement;
  }
  return true;
}
