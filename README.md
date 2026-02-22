# Napredne-Baze-Podataka - Uputstvo za pokretanje projekta "PlayTrack"

Ovaj dokument predstavlja kompletno, korak-po-korak uputstvo za konfiguraciju, pokretanje i inicijalizaciju projekta "PlayTrack". Sistem se oslanja na mikroservisnu arhitekturu i koristi Docker kontejnerizaciju za baze podataka (Neo4j i Cassandra), kao i za Node.js (Express) backend i React (Vite) frontend aplikaciju.

---

## 1. Sistemski preduslovi i instalacija softvera

Da bi se projekat uspešno pokrenuo, neophodno je instalirati odgovarajuće alate u zavisnosti od operativnog sistema koji koristite. Svi servisi su mapirani na specifične portove, pa pre pokretanja osigurajte da sledeći portovi na Vašem računaru nisu zauzeti: 3000, 3001, 7474, 7687, i 9042.

### 1.1. Instalacija Docker okruženja

Sistem koristi Docker i Docker Compose za orkestraciju kontejnera.

#### Za Windows korisnike:

Preuzmite "Docker Desktop for Windows" sa zvaničnog Docker veb-sajta (docker.com/products/docker-desktop).

Pokrenite instalacioni fajl i pratite instrukcije (ostavite podrazumevanu opciju za korišćenje WSL 2 backend-a).

Nakon instalacije, restartujte računar.

Pokrenite aplikaciju Docker Desktop i sačekajte da ikonica u sistemskom meniju postane zelena (status "Engine running").

#### Za macOS korisnike:

Preuzmite "Docker Desktop for Mac" sa zvaničnog Docker veb-sajta (obratite pažnju da li preuzimate verziju za Intel ili Apple Silicon/M-seriju procesora).

Otvorite preuzeti .dmg fajl i prevucite Docker u folder Applications.

Pokrenite Docker iz Applications foldera i odobrite potrebne sistemske dozvole.

#### Za Linux (Ubuntu/Debian) korisnike:

Otvorite terminal i ažurirajte repozitorijume:

```bash
sudo apt-get update
```

Instalirajte Docker Engine komandom:

```bash
sudo apt-get install docker.io -y
```

Instalirajte Docker Compose komandom:

```bash
sudo apt-get install docker-compose -y
```

Dodajte svog korisnika u Docker grupu kako ne biste morali da koristite sudo za svaku komandu:

```bash
sudo usermod -aG docker $USER
```

(nakon ovoga je neophodno odjaviti se i ponovo prijaviti na sistem).

---

### 1.2. Instalacija Node.js okruženja

Node.js je neophodan za lokalno pokretanje skripti koje inicijalizuju podatke u bazama.

Posetite zvanični sajt: nodejs.org.

Preuzmite i instalirajte LTS (Long Term Support) verziju.

Za proveru uspešne instalacije, otvorite terminal (ili Command Prompt/PowerShell na Windows-u) i ukucajte:

```bash
node -v
npm -v
```

(node -v treba da prikaže verziju Node.js-a)  
(npm -v treba da prikaže verziju Node Package Manager-a)

---

## 2. Pokretanje sistema

Projekat je organizovan tako da docker-compose.yml datoteka kontroliše celokupnu infrastrukturu.

### Korak 1: Pozicioniranje u direktorijum projekta

Otvorite terminal (ili Command Prompt/PowerShell) i pozicionirajte se u osnovni (root) direktorijum projekta gde se nalazi fajl docker-compose.yml.

Komanda:

```bash
cd putanja/do/direktorijuma/projekta
```

### Korak 2: Izgradnja i pokretanje Docker kontejnera

Izvršite sledeću komandu kako biste preuzeli potrebne slike baza podataka i izgradili backend i frontend kontejnere:

```bash
docker-compose up -d --build
```

Napomena: Argument -d pokreće kontejnere u pozadini (detached mode), dok --build osigurava da se Docker slike izgrade na osnovu vaših lokalnih datoteka.

### Korak 3: Čekanje na inicijalizaciju

Bazi podataka Cassandra je potrebno više vremena da se u potpunosti inicijalizuje. U docker-compose.yml datoteci je definisan period pokretanja (start_period) od 90 sekundi, dok backend aplikacija automatski pokušava da se poveže na Cassandru 10 puta sa pauzama od 5 sekundi.

Molimo Vas da sačekate približno 2 minuta pre prelaska na sledeći korak.

---

## 3. Inicijalizacija baze podataka (Seeding)

Kako biste sistem napunili testnim podacima (korisnici, igre, relacije), potrebno je pokrenuti priložene skripte. Pretpostavka je da se skripte nalaze u backend direktorijumu projekta gde se nalazi i package.json sa potrebnim zavisnostima (poput neo4j-driver i cassandra-driver).

### Korak 1: Instalacija zavisnosti

U terminalu, pozicionirajte se u backend direktorijum:

```bash
cd backend
```

Zatim instalirajte Node.js pakete potrebne za rad skripti komandom:

```bash
npm install
```

### Korak 2: Učitavanje Neo4j podataka

Pokrenite skriptu za brisanje starih i upis novih podataka u Neo4j grafovsku bazu. Ova skripta kreira čvorove (igrače, igre) i njihove međusobne relacije (praćenje, ocenjivanje, blokiranje).

```bash
node init-data.js
```

Skripta podrazumevano pristupa lokalnom portu 7687 i koristi korisničko ime "neo4j" sa lozinkom "password123".

### Korak 3: Sinhronizacija sa Cassandrom

Pokrenite drugu skriptu koja će podatke iz Neo4j baze pročitati, obraditi i upisati u Cassandra tabele (poput globalnog rangiranja i rangiranja po igrama).

```bash
node cassandra-sync-existing.js
```

---

## 4. Korišćenje aplikacije

Nakon uspešnog pokretanja i inicijalizacije podataka, sistemu možete pristupiti putem Vašeg veb pregledača.

### Frontend aplikacija (Korisnički interfejs):

Otvorite pregledač i idite na adresu:  
http://localhost:3000

Za prijavu možete koristiti testne naloge generisane u init-data.js fajlu (npr. korisničko ime: marko, lozinka: marko123).

### Backend API servis:

Dostupan na adresi:  
http://localhost:3001

Provera zdravlja (healthcheck) sistema je dostupna na:  
http://localhost:3001/health.

### Neo4j Browser (Administracija grafovske baze):

Otvorite pregledač i idite na adresu:  
http://localhost:7474

Podrazumevani korisnik (Username): neo4j  
Podrazumevana lozinka (Password): password123

---

## 5. Zaustavljanje sistema

Kada završite sa testiranjem projekta, preporučuje se isključivanje Docker kontejnera kako ne bi zauzimali sistemske resurse.

Vratite se u terminal, pozicionirajte se u osnovni (root) direktorijum projekta (gde se nalazi docker-compose.yml) i unesite komandu:

```bash
docker-compose down
```

Ova komanda će zaustaviti i obrisati kontejnere, dok će Vaši podaci ostati sačuvani unutar lokalnih "volume" instanci definisanih u konfiguraciji (poput neo4j_data i cassandra_data). Ukoliko želite potpuno da obrišete i sačuvane podatke, upotrebite komandu:

```bash
docker-compose down -v
```
