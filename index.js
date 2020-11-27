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
      link: false,
    };

    const browser = await puppeteer.launch({
      headless: true,
      args: ["--disabled-setuid-sandbox", "--no-sandbox"],
    });
    const page = await browser.newPage();
    //Funckja co wyciągnia strigów z elementów bez errorów

    try {
      //przechodzimy pod podany link
      console.log(req.body.queryText);
      await page.goto(req.body.queryText);
      await page.waitForNavigation();
      //sprawdzanie czy link jest prawidłowy
      const errPage = await page.$("div.section-bad-query-title");
      //sprawdzanie czy jest to lista wyników
      const selectPage = await page.$("div.section-result-content");
      //sprawdzamy czy zapytanie jest poprawne

      if (errPage === null) {
        //sprawdzamy czy wyświetla wyniki czy wizytówkę
        if (selectPage === null) {
          if (await page.$('button[aria-label="Wstecz"]')) {
            await page.$eval('button[data-tooltip="Wstecz"]', (btn) =>
              btn.click()
            );
            await page.waitForNavigation();
          }
          await page.screenshot({ path: "./whre.png" });
          const getInfo = await page.evaluate(() => {
            const select = (element) =>
              document.querySelector(element)
                ? document.querySelector(element).textContent
                : "brak danych";
            const sections = {
              title: "h1.section-hero-header-title-title",
              type: 'button[jsaction="pane.rating.category"]',
              adres: 'button[data-tooltip="Kopiuj adres"]',
              phone: 'button[data-tooltip="Kopiuj numer telefonu"]',
              revSum:
                'button.widget-pane-link[jsaction="pane.rating.moreReviews"]',
              average: "span.section-star-display",
            };

            let initalInfo = [
              {
                title: select(sections.title),
                type: select(sections.type),
                localization: select(sections.adres),
                phone: select(sections.phone),
                revSum: select(sections.revSum),
                average: select(sections.average),
              },
            ];

            return initalInfo;
          });

          results.package = getInfo;
          results.status = "ok";

          //Kiedy po wpisaniu za pomocą adresu wyskakuje parę wyników
        } else {
          const getResults = await page.evaluate(() => {
            const items = Array.from(
              document.querySelectorAll("div.section-result-text-content")
            );
            function getText(item, element) {
              return item.querySelector(element)
                ? item.querySelector(element).textContent === ""
                  ? "Brak danych"
                  : item.querySelector(element).textContent
                : "Brak danych";
            }
            let select = [];
            for (let i = 0; i < items.length; i++) {
              select.push({
                title: getText(items[i], "h3"),
                localization: getText(
                  items[i],
                  "span.section-result-location"
                ).replace(/\s/g, ""),
                type: getText(items[i], "span.section-result-details"),
                average: getText(items[i], "span.cards-rating-score"),
                revSum: getText(items[i], "span.section-result-num-ratings"),
                phone: getText(
                  items[i],
                  "span.section-result-info.section-result-phone-number"
                ),
              });
            }
            return select;
          });
          results.status = "select";
          results.package = getResults;
        }
      } else {
        results.status = "notFound";
      }
    } catch (err) {
      results.status = "err";
      results.package = err;
      console.log(err);
    } finally {
      if (results.status === "ok") {
        results.link = req.body.queryText;
      }
      await browser.close();
      res.json(results);
    }
  })();
});
app.post("/api/search/reviews", async (req, res) => {
  let response = {
    data: [],
    status: "",
    totalReviews: "",
  };

  console.log(
    "Hejka odebrałem twój request działam zobaczymy co z tego wyjdzie"
  );
  const browser = await puppeteer.launch();
  try {
    console.log(req.body.queryText);

    const page = await browser.newPage();
    await page.goto(req.body.queryText);
    await page.waitForNavigation();
    const revBtn = await page.$('button[jsaction="pane.rating.moreReviews"]');

    if (revBtn) {
      response.totalReviews = await page.$eval(
        'button[jsaction="pane.rating.moreReviews"]',
        (el) => {
          const text = parseInt(el.textContent.replace(/[^0-9]/g, ""));
          el.click();
          return text;
        }
      );
      await page.waitForNavigation();
      while (
        (await page.$$eval("div.section-review-title", (el) => el.length)) <
          response.totalReviews &&
        (await page.$$eval("div.section-review-title", (el) => el.length)) <= 25
      ) {
        await page.$eval("div.section-layout.section-scrollbox", (el) =>
          el.scrollBy(0, 1300)
        );
      }
      await page.waitForNavigation();
      const getRevs = await page.evaluate((response) => {
        const package = {
          reviews: [],
          revsInfo: [],
        };

        function intFn(str) {
          return parseInt(str.slice(13).replace(/[^0-9]/g, ""));
        }
        function selecor(item, str, aria) {
          if (item.querySelector(str)) {
            if (item.querySelector("button.section-expand-review.blue-link")) {
              item
                .querySelector("button.section-expand-review.blue-link")
                .click();
            }
            return aria
              ? item.querySelector(str).getAttribute("aria-label")
              : item.querySelector(str).textContent;
          } else {
            return "brak danych";
          }
        }
        Array.from(document.querySelectorAll("div.section-review-content")).map(
          (item) => {
            let itemData = {
              name: "",
              local: "",
              rating: "",
              data: "",
              text: "",
            };
            itemData.name = selecor(item, "div.section-review-title");
            itemData.local = selecor(item, "div.section-review-subtitle");
            itemData.rating = selecor(
              item,
              "span.section-review-stars",
              true
            ).replace(/[^0-9]/g, "");
            itemData.data = selecor(item, "span.section-review-publish-date");
            itemData.text = selecor(item, "span.section-review-text");
            package.reviews.push(itemData);
          }
        );
        const totalCount = response.totalReviews;
        //kolejnośc 5gwiazdkowe -> 1 gwiazdkowe
        Array.from(document.querySelectorAll('tr[role="image"]')).map((item) =>
          package.revsInfo.push(intFn(item.getAttribute("aria-label")))
        );

        return { ...package };
      }, response);
      response.data = getRevs;
      response.status = "ok";
    } else {
      response.status = "notFound";
    }
  } catch (err) {
    console.log(err);
    response.status = "err";
  } finally {
    console.log("Zapytanie skończone");
    await browser.close();
    res.json({ ...response });
  }
});
app.listen(3001);
