/* eslint-disable @typescript-eslint/ban-ts-ignore */
import minimist from "minimist";
import { Cluster } from "puppeteer-cluster";
import generateHash from "random-hash";
import { ContainerList, Resolution } from "./types";
import { ensureFolderExists, getFileName, screenshotElements } from "./utils";
import { getContainers } from "./getContainers";
import SITES from "./sites";
// imported so that typescript compiles the files
import "./browser-context/index";
import "./browser-context/overlap";
import "./browser-context/overflow";

import { screenshotRect } from "./utils";
import randomWords from "random-words";

const UNTOUCHED = "untouched";
const OVERFLOW = "overflow";
const OVERLAP = "overlap";

const EXECUTION_ID = `${new Date().getMonth()}-${new Date().getDate()}-${generateHash({ length: 4 })}`;
const VIEWPORTS: Resolution[] = [
  //{ width: 768, height: 2000 },
  { width: 375, height: 2000 },
  { width: 1000, height: 2500 }
];
const args = minimist(process.argv.slice(2));

console.log(`Starting scraping with args ${JSON.stringify(args)}`);
const BASE_FOLDER = args.folder || "layout-breaker-images/";
const DEBUG_MODE = args.debug;
const CONT_INDEX = args.contindex ? parseInt(args.contindex) : undefined;

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

(async (): Promise<void> => {
  const cluster = await Cluster.launch(clusterConfig);

  await cluster.task(scrapeSite);

  (args.site && args.site.length ? [args.site] : SITES).forEach((site) => {
    VIEWPORTS.forEach((viewport) => {
      cluster.queue({ site, viewport, manipulation: UNTOUCHED });
      cluster.queue({ site, viewport, manipulation: OVERFLOW });
      cluster.queue({ site, viewport, manipulation: OVERLAP });
    });
  });

  cluster.on("taskerror", (err, data) => {
    console.log(`------ERROR CRAWLING ${data.manipulation.toUpperCase()} ${data.site}-${data.viewport.width}x${data.viewport.height}`);
    console.log(`\n${err.filename}`);
    console.log(`\n${err.message}`);
    console.log(err.stack);
  });

  await cluster.idle();
  console.log("\n-----------------END RUN ", EXECUTION_ID, "-----------------------------------\n");
  await cluster.close();
})();

async function scrapeSite({ page, data: data }): Promise<void> {
  const { site, viewport, manipulation } = data;

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
  const folderName = `${BASE_FOLDER}/${manipulation}`;
  const entirePagesFolder = `${BASE_FOLDER}/entire-pages`;
  await ensureFolderExists(folderName);
  await ensureFolderExists(entirePagesFolder);
  await page.exposeFunction("screenshotRect", (params) => screenshotRect(page, params));
  await page.exposeFunction("randomWords", randomWords);

  // GET SCREENSHOTTED CONTAINERS
  const containers = await getContainers(page, CONT_INDEX);

  let elementCount = 0;
  const filepath = `${folderName}/${getFileName({ viewport, url: site, postfix: EXECUTION_ID })}`;
  if (manipulation === OVERFLOW) {
    elementCount = await page.evaluate(
      async (containers: ContainerList, filepath: string) => {
        //@ts-ignore
        return await generateOverflowScreenshots({ containers, filepath });
      },
      containers,
      filepath
    );
  } else if (manipulation === OVERLAP) {
    elementCount = await page.evaluate(
      async (containers: ContainerList, filepath: string) => {
        //@ts-ignore
        return await generateOverlapScreenshots({ containers, filepath });
      },
      containers,
      filepath
    );
  } else if (manipulation === UNTOUCHED) {
    elementCount = await screenshotElements({ page, elements: containers, filepath });
  } else {
    throw "Unknown manipulation";
  }

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
