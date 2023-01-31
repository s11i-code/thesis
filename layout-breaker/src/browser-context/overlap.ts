/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/ban-ts-ignore */
/* eslint-disable @typescript-eslint/no-unused-vars */

type Direction = "vertical" | "horizontal";
type Side = "top" | "bottom" | "right" | "left";
// @ts-ignore
if (!exports) {
  const exports = {};
}

// eslint-ignore no-namespace
export async function generateOverlapScreenshots({ containers, filepath }): Promise<number> {
  let count = 0;
  debugger;
  await Promise.all(
    containers.map(async (container: HTMLElement, idx: number) => {
      const randomChildIdx = getRandomInt(0, container.childElementCount - 1);
      const child = container.children[randomChildIdx] as HTMLElement;
      const childCount = container.childElementCount;
      if (childCount <= 1) {
        return Promise.resolve();
      }
      //@ts-ignore Cannot find name 'isVisibleInDOM'.ts(2304)
      if (!isVisibleInDOM(child)) {
        return Promise.resolve();
      }

      const contRect = container.getBoundingClientRect().toJSON();
      const layoutDirection = getLayoutDirection(container);
      const siblingFacingSide = getSiblingFacingSide(randomChildIdx === 0, randomChildIdx === childCount, layoutDirection);

      //@ts-ignore Cannot find name 'fixDimensions'.ts(2304)
      fixDimensions(container, contRect);
      const { clientWidth } = document.documentElement;
      const offset: number = getRandomInt(clientWidth / 20, clientWidth / 15);
      const prevMargin = child.style[`margin-${siblingFacingSide}`];
      const { display: prevDisplay } = child.style;
      child.style[`margin-${siblingFacingSide}`] = `-${offset}px`;
      child.style.display = `inline-block`;
      count++;
      //@ts-ignore 'Cannot find namescreenshotRect'
      await screenshotRect({ rect: contRect, filepath: `${idx}-${filepath}` });

      //reset margin:
      child.style[`display`] = `${prevDisplay}`;
      child.style[`margin-${siblingFacingSide}`] = `${prevMargin}`;
    })
  );
  return count;
}

// RANDOM STUFF
export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
}

export function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function meanOfAbs(arr: number[]): number {
  const sum = arr.reduce((prev, curr) => {
    return prev + Math.abs(curr);
  }, 0);
  return sum / arr.length;
}

function distances(arr: DOMRect[], dir: Direction): number[] {
  return arr.flatMap((curr, idx) => {
    if (idx === 0) {
      return [];
    }

    const prev = arr[idx - 1];
    if (dir === "horizontal") {
      return prev.right - curr.left;
    } else {
      return prev.bottom - curr.top;
    }
  });
}

function getSiblingFacingSide(isFirst: boolean, isLast: boolean, direction: Direction): Side {
  if (direction === "horizontal") {
    if (isFirst) {
      return "right";
    }
    if (isLast) {
      return "left";
    } else {
      return getRandomElement(["left", "right"]) as Side;
    }
  } else {
    if (isFirst) {
      return "bottom";
    }
    if (isLast) {
      return "top";
    } else {
      return getRandomElement(["top", "bottom"]) as Side;
    }
  }
}

function getLayoutDirection(container: HTMLElement): Direction {
  const childRects = Array.from(container.children).map((el) => el.getBoundingClientRect());
  const verDistances = distances(childRects, "vertical");
  const horDistances = distances(childRects, "horizontal");

  return meanOfAbs(verDistances) < meanOfAbs(horDistances) ? "vertical" : "horizontal";
}
