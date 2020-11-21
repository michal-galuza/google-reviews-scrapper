const puppeteer = require("puppeteer");
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.post("/api/search", function (req, res) {
  (async () => {
    let results = {
      status: "",
      package: "",
    };
    const query = "https://maps.google.com?q=" + req.body.queryText;
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--disabled-setuid-sandbox", "--no-sandbox"],
    });
    const page = await browser.newPage();
    try {
      await page.goto(query);
      await page.waitForNavigation();

      const errPage = await page.$("div.section-bad-query-title");
      if (errPage === null) {
        const getInfo = await page.evaluate(() => {
          const select = (element) =>
            document.querySelector(element)
              ? document.querySelector(element).textContent
              : "brak danych";

          const sections = {
            title: "h1.section-hero-header-title-title",
            type: 'button[jsaction="pane.rating.category"]',
            adres: 'button[data-tooltip="Kopiuj adres"]',
            webSite: 'button[data-tooltip="Otwórz witrynę"]',
            phone: 'button[data-tooltip="Kopiuj numer telefonu"]',
            revSum:
              'button.widget-pane-link[jsaction="pane.rating.moreReviews"]',
          };

          let initalInfo = {
            tile: select(sections.title),
            type: select(sections.type),
            adres: select(sections.adres),
            webSite: select(sections.webSite),
            phone: select(sections.phone),
            revSum: select(sections.revSum),
            average: "",
            g1: "",
            g2: "",
            g3: "",
            g4: "",
            g5: "",
          };
          if (initalInfo.revSum !== "brak danych") {
            document.querySelector(sections.revSum).click();

            setTimeout(() => {}, 100);
            const reviewsScore = Array.from(
              document.querySelectorAll('tr[role="image"]')
            );
            initalInfo.average = document.querySelector(
              "div.gm2-display-2"
            ).textContent;
            reviewsScore.map(
              (item, index) =>
                (initalInfo[`g${index + 1}`] = item.getAttribute("aria-label"))
            );
          } else {
            initalInfo.g1 = "brak opinii";
            initalInfo.g2 = "brak opinii";
            initalInfo.g3 = "brak opinii";
            initalInfo.g4 = "brak opinii";
            initalInfo.g5 = "brak opinii";
            initalInfo.average = "brak opinii";
          }
          return initalInfo;
        });

        results.package = getInfo;
        results.status = "ok";
      } else {
        results.status = "no";
      }
    } catch (err) {
      results.status = "err";
    } finally {
      await browser.close();
      res.json(results);
    }
  })();
});
app.listen(3001);
