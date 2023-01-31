/* eslint-disable @typescript-eslint/ban-ts-ignore */
import minimist from "minimist";
import puppeteer from "puppeteer";
import { Cluster } from "puppeteer-cluster";
import generateHash from "random-hash";
import { ContainerList, Resolution } from "./types";
import { ensureFolderExists, getFileName, screenshotElements } from "./utils";
import { getContainers } from "./getContainers";
import { Page } from "puppeteer";
import SITES from "./sites";
// imported so that typescript compiles the files
// import "./browser-context/index";
import "./browser-context/overlap";
// import "./browser-context/overflow";

import { screenshotRect } from "./utils";
import randomWords from "random-words";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { generateOverlapScreenshots } from "./browser-context/overlap";
import { generateOverflowScreenshots } from "./browser-context/overflow";

const UNTOUCHED = "untouched";
const OVERFLOW = "overflow";
const OVERLAP = "overlap";

const manipulations = [UNTOUCHED, OVERFLOW, OVERLAP] as const;

type Manipulation = typeof manipulations[number];

const EXECUTION_ID = `${new Date().getMonth()}-${new Date().getDate()}-${generateHash({ length: 4 })}`;
const VIEWPORTS: Resolution[] = [
  //{ width: 768, height: 2000 },
  //{ width: 375, height: 2000 },
  { width: 1000, height: 2500 }
];

interface Args {
  folder: string;
  debug: string;
  contindex: string;
  site: string;
  _: any; //something added by minimist?
}
const args: Args = minimist<Args>(process.argv.slice(2));

const DEFAULT_FOLDER = "layout-breaker-images/";
const { folder: BASE_FOLDER = DEFAULT_FOLDER, debug, contindex, site: SITE, ...rest } = args;

const CONT_INDEX = contindex ? parseInt(contindex) : undefined;
const DEBUG_MODE = !!debug;

const extraArgs = Object.keys(rest).filter((key) => !["_", "inspect"].includes(key));
debugger;
if (extraArgs) {
  //throw new Error(`Unknown command line argument(s): ${JSON.stringify(rest)}`);
}

console.log(`Starting scraping DEBUG_MODE ${DEBUG_MODE}, with args: ${JSON.stringify(args)}`);

interface TaskData {
  site: string;
  viewport: Resolution;
  baseFolder: string;
  manipulation: Manipulation;
}

const puppeteerOptions = {
  headless: !DEBUG_MODE,
  devtools: DEBUG_MODE
  // executablePath: "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
};

const clusterConfig = {
  monitor: true,
  puppeteerOptions,
  maxConcurrency: DEBUG_MODE ? 1 : 4,
  timeout: DEBUG_MODE ? 15000000 : 30000,
  concurrency: Cluster.CONCURRENCY_CONTEXT
};

const RUN_PARALLEL = false;

(async (): Promise<void> => {
  let cluster = undefined;

  if (RUN_PARALLEL) {
    cluster = Cluster.launch(clusterConfig);

    await cluster.task(scrapeSite);
    cluster.on("taskerror", (err, data) => {
      console.log(`------ERROR CRAWLING ${data.manipulation.toUpperCase()} ${data.site}-${data.viewport.width}x${data.viewport.height}`);
      console.log(`\n${err.filename}`);
      console.log(`\n${err.message}`);
      console.log(err.stack);
    });
  }

  const sites = SITE && SITE.length ? [SITE] : SITES;
  console.log("BASE FOLDER", BASE_FOLDER);

  // sites.forEach((site) => {
  //   VIEWPORTS.forEach(async (viewport) => {
  //     for (const manipulation of manipulations) {
  //       const taskData: TaskData = {
  //         baseFolder: BASE_FOLDER,
  //         site,
  //         viewport,
  //         manipulation
  //       };

  //       if (cluster) {
  //         cluster.queue(taskData);
  //       } else {
  //         const browser = await puppeteer.launch();
  //         const page = await browser.newPage();
  //         scrapeSite({ page, data: taskData });
  //       }
  //     }
  //   });
  // });

  if (cluster) {
    await cluster.idle();
    await cluster.close();
  }
  console.log("\n-----------------END RUN ", EXECUTION_ID, "-----------------------------------\n");
})();

async function scrapeSite({ page, data }: { page: Page; data: TaskData }): Promise<void> {
  const { site, viewport, manipulation, baseFolder } = data;

  await page.setBypassCSP(true);
  await page.goto(site, { waitUntil: "networkidle2", timeout: 0 });
  await page.setViewport({ ...viewport, deviceScaleFactor: 1 });
  await page.addScriptTag({ path: "./build/browser-context/index.js" });
  await page.addScriptTag({ path: "./build/browser-context/overlap.js" });
  await page.addScriptTag({ path: "./build/browser-context/overflow.js" });

  // print page context logs to terminal(=node context):
  page.on("console", (consoleObj) => {
    console.log(consoleObj.text());
  });

  // DEFINE FOLDERS
  const folderName = `${baseFolder}/${manipulation}`;
  console.log("folderName", folderName);
  await ensureFolderExists(folderName);

  return;
  const entirePagesFolder = `${BASE_FOLDER}/entire-pages`;
  await ensureFolderExists(entirePagesFolder);
  await page.exposeFunction("screenshotRect", (params) => screenshotRect(page, params));
  await page.exposeFunction("randomWords", randomWords);

  // GET SCREENSHOT ELEMENTS
  const containers = await getContainers(page, CONT_INDEX);
  const filepath = `${folderName}/${getFileName({ viewport, url: site, postfix: EXECUTION_ID })}`;

  let promise = null;
  if (manipulation === OVERFLOW) {
    promise = page.evaluate(
      async (containers: ContainerList, filepath: string) => {
        return await generateOverflowScreenshots({ containers, filepath });
      },
      containers,
      filepath
    );
    // } else if (manipulation === OVERLAP) {
    //   promise = page.evaluate(
    //     async (containers: ContainerList, generateOverlapScreenshots, filepath: string) => {
    //       return await generateOverlapScreenshots({ containers, filepath });
    //     },
    //     containers,
    //     filepath
    //   );
  } else if (manipulation === UNTOUCHED) {
    promise = screenshotElements({ page, elements: containers, filepath });
  } else {
    throw "Unknown manipulation";
  }

  promise.catch((err) => {
    console.log("ERROR heer", err);
    return 0;
  });

  const elementCount = await promise;
  //await screenshotRects(page, rects, folderName, viewport, site);
  console.log(
    `Number of ${manipulation.toUpperCase()} rects is  ${elementCount} for site ${site} in ${viewport.width}x${viewport.height}.`
  );

  await page.screenshot({
    path: `${entirePagesFolder}/${getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: manipulation })}.png`
  });

  if (manipulation === UNTOUCHED) {
    // show containers with red border for debugging
    await page.evaluate(async function (containers) {
      await Promise.all(containers.map((el) => ((el as HTMLElement).style["border"] = "1px solid red")));
    }, containers);
    await page.screenshot({
      path: `${entirePagesFolder}/${getFileName({ viewport, url: site, prefix: EXECUTION_ID, postfix: "containers" })}.png`
    });
  }
}
