/* eslint-disable @typescript-eslint/ban-ts-ignore */

interface Params {
  containers;
  filepath: string;
}

export async function generateOverflowScreenshots({ containers, filepath }: Params): Promise<number> {
  let count = 0;
  await Promise.all(
    containers.map(async (cont: HTMLElement, idx: number) => {
      if (cont.childElementCount < 2 && cont.tagName !== "button") {
        return Promise.resolve();
      }

      //@ts-ignore Cannot find name 'getRandomDescendent'.ts(2304)
      const randDescendent = getRandomDescendent(cont);

      if (!randDescendent || !randDescendent.innerText) {
        return Promise.resolve();
      }

      await generateOverflow(randDescendent, `${filepath}-${idx}`, cont);
      count++;
    })
  );
  return count;
}

function getClosestBlockParent(startElement: HTMLElement): HTMLElement {
  let element = startElement;
  while (window.getComputedStyle(element)["display"] !== "block") {
    element = element.parentElement;
  }
  return element;
}

async function generateOverflow(child: HTMLElement, filepath: string, container: HTMLElement): Promise<void> {
  const childRect = child.getBoundingClientRect();

  // if (child.style["display"] !== "block") {
  //   // TODO: display: block can change layout  e.g align:center
  //   // but it's the only thing that will enforce limit restrictions properly

  //   child.style["display"] = "inline-block";
  // }

  //could be like p tag
  const blockParent = getClosestBlockParent(child);
  //@ts-ignore Cannot find name 'fixDimensions'.ts(2304)
  fixDimensions(blockParent, blockParent.getBoundingClientRect());

  // THE GIST IS HERE: increase text to create overflow
  const oldText = child.innerText;
  const newText = await generateText(oldText, child, childRect);
  child.innerText = newText;
  //debugger;

  // create overflow
  child.style["overflow"] = "revert";
  child.style["text-overflow"] = "visible";

  //debugger;
  //@ts-ignore Cannot find name 'screenshotRect'.ts(2304)
  await screenshotRect({
    rect: container.getBoundingClientRect().toJSON(),
    filepath: `${filepath}`
  });
  child.innerText = oldText; // reset text
}

async function generateText(originalText: string, element: HTMLElement, rect: DOMRect): Promise<string> {
  const style = window.getComputedStyle(element);
  const { fontSize } = style;
  const fontSizePx = parseInt(fontSize);
  const horizontalSpace = computeSpace(style, rect).width;
  const leftoverSpaceFactor = Math.ceil((horizontalSpace * originalText.length) / fontSizePx / 75);
  const min = Math.min(6, leftoverSpaceFactor);
  const max = min * 2;
  //@ts-ignore "Cannot find randomWords"
  const text = `${originalText} ${await randomWords({ min, max, join: " " })}`;
  return text;
}

type Rect = { width: number; height: number };
function computeSpace(style: CSSStyleDeclaration, rect: DOMRect): Rect {
  // The element's size is equal to its width/height + padding + border-width
  // in the case that the standard box model is being used,
  // or width/height only if box-sizing: border-box has been set on it.

  const { boxSizing, paddingTop, paddingBottom, paddingLeft, paddingRight } = style;

  if (boxSizing === "border-box") {
    const { width, height } = rect.toJSON();
    return { width, height };
  } else {
    const verticalPadding = parseInt(paddingTop) + parseInt(paddingBottom);
    const horizontalPadding = parseInt(paddingLeft) + parseInt(paddingRight);
    return {
      width: rect.width + horizontalPadding,
      height: rect.height + verticalPadding
    };
  }
}
