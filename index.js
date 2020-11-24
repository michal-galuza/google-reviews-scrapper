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
      link: "",
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
                localization: getText(items[i], "span.section-result-location"),
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
      results.status === "ok" ? (results.link = page.url()) : "Brak danych";
      await browser.close();
      res.json(results);
    }
  })();
});
app.listen(3001);
