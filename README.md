# Desert Trade: The Game

A trading game for 7th grade World History. Students create a trader, buy goods in medieval cities, cross the Sahara and Arabia, survive road encounters, and sell for profit. Leaderboards track the richest traders and the caravans with the highest average wealth.

**Pages on the site**

| Page | Address | Who |
|---|---|---|
| Game | `/` | Students |
| Dashboard | `/dashboard.html` | Projector view, refreshes every 10 seconds |
| Teacher controls | `/teacher.html` | You |

---

## Setup (about 15 minutes, no coding needed)

### 1. Put the code on GitHub
1. Create a new repository on GitHub (for example `desert-trade`). It can be private.
2. Unzip this folder, then on the repository page click **Add file → Upload files** and drag in everything inside the `desert-trade` folder (`public`, `functions`, `lib`, `schema.sql`, `wrangler.toml`, `README.md`). Commit.

### 2. Create the database in Cloudflare
1. In the Cloudflare dashboard go to **Storage & Databases → D1 SQL Database → Create**.
2. Name it `desert-trade-db` and create it.
3. Open the database, click the **Console** tab, paste everything from `schema.sql`, and click **Execute**.
4. Copy the **Database ID** shown on the database page.
5. Back on GitHub, open `wrangler.toml`, click the pencil icon, replace `PASTE-YOUR-D1-DATABASE-ID-HERE` with your ID, and commit.

### 3. Create the Pages site
1. In Cloudflare go to **Workers & Pages → Create → Pages → Connect to Git** and pick your repository.
2. Build settings: **Framework preset: None**, **Build command: leave blank**, **Build output directory: `public`**.
3. Click **Save and Deploy**.

### 4. Set your teacher password
1. Open the Pages project → **Settings → Variables and Secrets → Add**.
2. Type: **Secret**. Name: `TEACHER_PASSWORD`. Value: a password only you know.
3. Save, then go to **Deployments** and click **Retry deployment** on the latest one so the password takes effect.

> If the game ever says "Database not connected," check **Settings → Bindings** in the Pages project. There should be a D1 binding named `DB` pointing at `desert-trade-db`. Add it there if it's missing, then redeploy.

### 5. Before class
1. Visit `/teacher.html` and log in.
2. **Levels tab:** change the five level codes (the defaults are `camel1` to `camel5`, which students could guess). Adjust days, instructions, starting city and bonuses if you like.
3. **Market prices tab:** check Jerusalem and Mecca. The planning sheet didn't list prices for those two cities, so they start with placeholder values.
4. **Game settings tab:** set starting money (default $100; Level 1 adds $200 on top). Travel runs at 1 day per second by default. A 117-day trip takes about 2 minutes, so lower this if class time is tight.

---

## How the game plays

- Students create a trader name and password, then enter the Level 1 code you give them.
- Each level opens with a title page showing the days allowed, starting city and instructions.
- In each city: **Go to Market**, **Check Inventory**, **End Level**, or pick a destination and **Depart**.
- **Markets** have a Provisions section (food and water), Exports (the city sells, students buy) and Imports (the city buys, students sell). Every shop has a quantity selector and a Haggle button (50/50 chance of 5% better or 5% worse, once per shop per visit). Students can't spend more than they have.
- **Market questions:** before a market opens, students answer multiple-choice questions about Islam and desert trade. They need as many correct in a row as their level number (Level 3 = 3 in a row). A wrong answer shows the right answer and restarts the count. Questions live in `lib/data.js`. You can turn this off in Game settings.
- **Trader School** (Cairo only) sells five classes: Oasis Mapping, Hazard Training I, Hazard Training II, Haggle Training and Real Bedouin Training. Prices are $50 in Level 1 and rise $200 per level. Classes last the rest of the game.
- **Travel** shows a "Days traveling" counter. Halfway through, a random encounter appears. Students pick one of 10 hidden choices; the server shuffles what's behind them for every trip, so there's no "best" button. After they pick, all 10 are revealed.

| Encounter | Chance | Safe choices | What happens |
|---|---|---|---|
| Base Camp | whatever is left (45% by default) | no choice | rest and continue |
| Bandits | 5%, and every trip into Taghaza | 7 of 10 | fail: lose 25% of supplies and 25% of money |
| Sandstorm | 10% | 6 of 10 | fail: lose 25% of supplies and 25 days |
| Extreme Heat | 10% | 7 of 10 | fail: lose all water and perish |
| Extreme Cold | 10% | 7 of 10 | fail: freeze and perish |
| Oasis | 10% | all 10 | gain 1 to 5 food and water |
| Mansa Musa | 5% | all 10 | gain 10 to 100 lb of gold |
| Ben and James | 5%, once per game | 3 named choices | share 2 food and 2 water for $200, leave them, or demand money and perish |

Change any chance or safe-choice count on the teacher page's **Encounters** tab.

- **Supplies:** every 25 days of travel (or part of 25) uses 1 lb food and 1 jug water. A 70-day trip needs 3 of each. Running out means perishing.
- **Perishing** shows the "sands of time" screen with a button to restart the level with the money and goods they had when it began.
- **Ending a level early** pays the per-day bonus (default $2) for each unused day. When the days run out, the level ends automatically. Money and goods carry into the next level.
- **Caravans:** any student can start one with a password. Up to 5 traders per caravan. Caravans rank by average wealth.

## Teacher tools

- **Levels:** codes, days, instructions, starting city, starting bonus, early-finish bonus.
- **Traders:** see everyone's level, status, location, money and goods. Move a trader to any level, reset a forgotten password, remove from a caravan, or delete.
- **Give bonuses & skills:** money, items and/or a free Trader School class to traders you check off, a whole caravan or the whole class, with a reason that appears in their log. You can also take a class away.
- **Encounters:** how often each road event happens and how many of the 10 choices are safe.
- **Caravans:** see members and disband if needed.
- **Market prices:** edit every buy and sell price, plus food and water, in every city.
- **Game settings:** starting money, travel speed, market questions on/off, Trader School prices, whether bandits and sandstorms take only supplies or all cargo, and a reset button for starting fresh with a new class.

## Updating from the first version

Replace the files in your GitHub repository with the ones in this zip and commit. Cloudflare redeploys on its own. You don't need to run any SQL: the first time the new version runs, it adds the two new database columns (skills and progress flags) by itself. Existing traders keep their money, goods and levels.

## Changing things in the code

- City descriptions, item descriptions, distances, encounter text, skill descriptions and market questions: `lib/data.js`
- Game rules and the API: `lib/api.js`
- Student screens: `public/js/app.js`. Teacher page: `public/js/teacher.js`. Dashboard: `public/js/dashboard.js`
- Colors and fonts: the top of `public/css/style.css`

Commit a change on GitHub and Cloudflare redeploys automatically in about a minute.
