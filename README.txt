RU ARACI TAKIMI SATIŞ DASHBOARD’U

Bu sürüm yeni RU ekibi için hazırlanmıştır.

Satıcılar:
- Şebnem Mammadova
- Alican Kulyyev
- Balzhan ADREISSOVA
- ÇINARA AKYÜZ
- Rana Ekiz

Veri eşleştirmeleri:
- Satıcı: Sorumlu Kişi
- Aracı: Source HBYS
- Lead tarihi: YD New Lead - Arrived Time
- Teklif tarihi: YD Quoted - Arrived Time
- Satış tarihi: YD Deal Won - Arrived Time
- Tutar: USD Karşılığı
- Tekilleştirme: Bitrix ID

Google E-Tablo sayfaları:
- Ham Lead
- Ham Teklif
- Ham Deal Won
- Hedefler
- Ayarlar

Render ortam değişkenleri:
- APPS_SCRIPT_URL = yeni Apps Script web uygulaması URL’si (/exec ile biter)
- APPS_SCRIPT_API_KEY = Apps Script Özellikleri bölümündeki API_KEY
- SESSION_SECRET = uzun ve rastgele bir metin
- USERS_JSON = kullanıcı ve bcrypt şifre özeti
- NODE_ENV = production
- APPS_SCRIPT_TIMEOUT_MS = 150000

Kurulum:
1. Dosyaları GitHub deposuna yükleyin.
2. Render’da depoyu seçerek yeni Web Service oluşturun.
3. Build Command: npm install
4. Start Command: npm start
5. Yukarıdaki ortam değişkenlerini ekleyin.
6. Deploy işlemini başlatın.

Notlar:
- API anahtarı frontend dosyalarına yazılmaz.
- Aracı Dashboard, ayrı bir Ham Koordinatör sayfasına ihtiyaç duymaz.
- Aracı adları Source HBYS sütunundan otomatik alınır.
- Aracı performansı Ham Lead’deki Source HBYS ile Ham Teklif ve Ham Deal Won’daki aynı Bitrix ID’lerin eşleşmesinden hesaplanır.
- Lead → teklif hızı yalnızca aynı ay içindeki YD New Lead - Arrived Time ve YD Quoted - Arrived Time kayıtlarından ölçülür.
