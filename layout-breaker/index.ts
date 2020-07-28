/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-ts-ignore */
import fs from "fs";
import puppeteer, { Page } from "puppeteer";
import { Resolution } from "./types";
import minimist from "minimist";
//import randomSentence from "random-sentence";

const sites = ["https://www.yle.fi"];

const resolutions: Resolution[] = [{ width: 1000, height: 3000 }];

const args = minimist(process.argv.slice(2));
const browserSettings = {
  headless: args.headless || false,
  devtools: args.devtools || false
};

(async (): Promise<any> => {
  const browser = await puppeteer.launch(browserSettings);
  const page: Page = await browser.newPage();
  await page.exposeFunction("generateText", generateText);
  await page.exposeFunction("getRandomInt", getRandomInt);

  const sitePromises = sites.map(async (site) => {
    await page.goto(site, { waitUntil: "networkidle2" });

    await Promise.all(
      resolutions.map(async (res) => {
        await page.setViewport({
          ...res,
          deviceScaleFactor: 1
        });

        // GET ORIGINAL CONTAINERS THAT WILL BE SCREENSHOTTED
        const containers = await page.evaluateHandle(async () => {
          const filterContainer = (viewport: Resolution, rect: DOMRect): boolean => {
            return isInViewport(viewport, rect) && isOptimalSize(rect);
          };

          const isInViewport = (viewport: Resolution, bounding: DOMRect): boolean =>
            bounding.top >= 0 && bounding.left >= 0 && bounding.right <= viewport.width && bounding.bottom <= viewport.height;

          const inRange = (value: number, range: [number, number]): boolean => value >= range[0] && value <= range[1];

          const isOptimalSize = (bounding: DOMRect): boolean => {
            const { width, height } = bounding;
            return inRange(height, [50, 400]) && width > 150;
          };
          const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
          return Array.from(document.querySelectorAll("section, article, div")).filter((elem: HTMLElement) => {
            const rect = elem.getBoundingClientRect();
            return filterContainer(viewport, rect);
          });
        });

        const originalRects = await page.evaluate((containers) => {
          const rects = Array.from(containers).map((elem: HTMLElement) => {
            const { x, y, width, height, bottom, top, right, left } = elem.getBoundingClientRect();
            return { x, y, width, height, bottom, top, right, left };
          });
          return rects;
        }, containers);

        const originalsFolder = `${getFolderPath(res, site, "originals")}`;
        await ensureFolderExists(originalsFolder);

        await page.screenshot({ path: `${originalsFolder}/page.png` });

        await screenshotRects(page, originalRects, originalsFolder);

        // MANIPULATE AND SCREENSHOT CONTAINERS

        const overFlowingRects = await page.evaluate(async (containers) => {
          const rects = await Promise.all(
            Array.from(containers).map(async (elem: HTMLElement) => {
              async function getRandDescendent(element: HTMLElement): Promise<HTMLElement> {
                // get a random descendent that has no children
                let randDescendent = element;
                while (randDescendent.childElementCount > 0) {
                  const childIdx = await getRandomInt(0, randDescendent.childElementCount - 1);
                  randDescendent = randDescendent.children[childIdx] as HTMLElement;
                }
                return randDescendent;
              }

              const { x, y, width, height, bottom, top, right, left } = elem.getBoundingClientRect();
              const randDescendent = await getRandDescendent(elem);
              const descendentRect = randDescendent.getBoundingClientRect();
              console.log("descrect", descendentRect);
              if (randDescendent.tagName === "IMG") {
                randDescendent.style.width = `${descendentRect.width * 1.2}`;
              } else {
                // fix size to prevent element from expanding:
                randDescendent.style["display"] = "block";
                randDescendent.style["max-width"] = `${descendentRect.width}px`;
                randDescendent.style["width"] = `${descendentRect.width}px`;
                randDescendent.style["max-height"] = `${descendentRect.height}px`;
                randDescendent.style["height"] = `${descendentRect.height}px`;

                randDescendent.innerText = randDescendent.innerText + randDescendent.innerText;
              }

              return { x, y, width, height, area: width * height, bottom, top, right, left };
            })
          );
          return rects;
        }, containers);

        const overflowingFolder = `${getFolderPath(res, site, "overflowing")}`;
        await ensureFolderExists(overflowingFolder);

        await page.screenshot({ path: `${overflowingFolder}/page.png` });

        await screenshotRects(page, overFlowingRects, overflowingFolder);

        console.log("Scraped site", overflowingFolder, "and ", originalsFolder);
      })
    );
    return Promise.resolve();
  });

  await Promise.all(sitePromises);

  console.log("BROWSER CLOSE");
  await browser.close();
})();

async function screenshotRects(page, rects: any[], folder: string, padding = 15): Promise<any> {
  return Promise.all(
    rects.map((rect: DOMRect, idx: number) => {
      return page.screenshot({
        path: `${folder}/${idx}.png`,
        clip: {
          x: rect.left - padding,
          y: rect.top - padding,
          width: rect.width + padding * (rect.left > padding ? 2 : 1),
          height: rect.height + padding * (rect.top > padding ? 2 : 1)
        }
      });
    })
  );
}

function generateText(original): string {
  return original + original;
}

function getRandomInt(min, max): number {
  return Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + min;
}

async function ensureFolderExists(path: string): Promise<any> {
  return fs.mkdir(path, { recursive: true }, (err) => {
    if (err) {
      console.log("Error while creating the folder", err);
      return;
    }
  });
}

function getFolderPath(resolution: Resolution, url: string, type: string): string {
  let path = "tmp/";
  if (resolution) {
    path = `${path}${resolution.width}x${resolution.height}`;
  }
  const { hostname } = new URL(url);
  return `${path}/${hostname}/${type}`;
}

// await page.waitForSelector(el);

// async function ensureFolderExists(path: string) {
//   const syncFolderPath = `tmp/${path}`;
//   return fs.mkdir(syncFolderPath, { recursive: true }, (err) => {
//     if (err) {
//       console.log("Error while creating the folder", err);
//       return;
//     }
//   });
// }

// function getFolderPath(resolution: Resolution, url: string, type: "broken" | "original"): string {
//   let path = "";
//   if (resolution) {
//     path = `${resolution.width}x${resolution.height}`;
//   }
//   const hostname = new URL(url).hostname;
//   return `${path}/${hostname}/${type}`;
// }

// async function writeJSON(path: string, data:any) {
//     const jsonString = JSON.stringify(data);
//     const syncFolderPath = `tmp/${path}`
//     return fs.mkdir(syncFolderPath, { recursive: true }, (err) => {
//         if (err) {
//             console.log("Error while creating the folder", err);
//             return;
//         }
//         fs.writeFile(`${syncFolderPath}/data.json`, jsonString, function(err) {
//             if (err) {
//                 console.log("Error writing file", err);
//             }
//         });
//     });
// }

// function generateId(text: string, rect: Rect): string {
//   return `${stringHash(text)}-top-${rect.top}-left-${rect.left}`;
// }

//const originalElements = await page.evaluate(() => {
//     const elements = [];
//     getChildrenBelowThreshold(elements, document.body);
//     return elements;

//     function isVisible(element: any): boolean {
//       const IGNORED_TAGS = ["style", "script", "noscript"];
//       const takesSpace = element.offsetWidth > 0 && element.offsetHeight > 0;
//       if (IGNORED_TAGS.includes(element.tagName) || !takesSpace) {
//         return false;
//       }

//       const { display, visibility, opacity, clip } = window.getComputedStyle(element);
//       return takesSpace && visibility !== "hidden" && display !== "none" && opacity !== "0" && clip !== "rect(1px, 1px, 1px, 1px)";
//     }

//     function getChildrenBelowThreshold(elements, element) {
//       const rect: Rect = element.getBoundingClientRect();
//       const { height, width } = rect;
//       const elementArea = width * height;

//       const windowArea = innerHeight * innerWidth;
//       const maxArea = windowArea * 0.3;
//       const minArea = windowArea * 0.05;

//       if (!isVisible(element)) {
//         return;
//       }

//       if (elementArea > maxArea) {
//         Array.from(element.children).forEach((child) => {
//           getChildrenBelowThreshold(elements, child);
//         });
//       } else if (elementArea > minArea) {
//         debugger;
//         elements.push();
//       }
//     }
//   });
