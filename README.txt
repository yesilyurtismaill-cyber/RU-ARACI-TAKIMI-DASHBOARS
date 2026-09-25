BOOKIMED SALES PORTAL - APPS SCRIPT VERSION

Bağlı Apps Script URL:
https://script.google.com/macros/s/AKfycbxz4tYnGpkXq8K-GRU1McbcSBuzpFDxPncNimWMzYuuqkrrOBpwDbrXOQhF-SJYH5NOVw/exec

Kurulum:
1) .env.example dosyasını .env olarak kopyalayın.
2) APPS_SCRIPT_API_KEY alanına kendi gizli API_KEY değerinizi yazın.
3) SESSION_SECRET değerini uzun rastgele bir değerle değiştirin.
4) Admin şifresi için bcrypt hash üretin:
   node -e "import('bcryptjs').then(async b=>console.log(await b.hash('SIFRENIZ',10)))"
5) Hash'i USERS_JSON içindeki passwordHash alanına koyun.
6) npm install
7) npm start
8) http://localhost:3000

Not:
- API_KEY frontend'e yazılmaz; yalnızca sunucuda tutulur.
- Bekleyen vaka tablolarında hasta adının görünmesi için Apps Script teklif/lead verisindeki hasta adı kolonunu göndermelidir.
- Hedefler sekmesi yoksa DEFAULT_MONTHLY_TARGET kullanılır.
BOOKIMED SALES DASHBOARD — GELİŞTİRİLMİŞ SÜRÜM

Son güncelleme:
- Büyük KPI kartları yerine kompakt satış özeti tablosu
- Teklif hızı + bekleyen vakalar için ortak satıcı sekmeli Operasyon Merkezi
- Koordinatör Red Flag: ekip ortalaması üzerinde lead gönderip hiç satış üretmeyenler
- Güçlü Koordinatörler: yeterli lead hacmi ve yüksek dönüşüm oranı
- Bekleyen vakalarda Genel + satıcı sekmeleri ve satıcı başına en eski 8 vaka
- Lead grafiğinde Genel + satıcı sekmeleri; ay seçildiğinde günlük kırılım
- Lead → Teklif → Expected → Gerçekleşen satış görsel akışı
- Koordinatör satış akışı grafiği ve dönüşüm göstergesi
- Ekran önbelleği ve arka planda ön yükleme ile daha hızlı geçişler

Yeni dashboard özellikleri:
- Günlük/aylık lead akışı grafiği
- Satıcı bazlı lead dağılımı
- 24 saat, 48 saat ve 7+ gün açık vaka aksiyon kartları
- En çok bekleten satıcılar ve aging analizi
- Bitrix ID ve hasta adını ayrı gösteren bekleyen vaka ve açık teklif tabloları
- Büyük açık vakalarda seçili ay içinde başlangıç/bitiş tarihi ve Bugün filtresi
- Büyük açık vakalarda mevcut ay/satıcı/tutar/tarih filtrelerine göre biçimlendirilmiş gerçek .xlsx Excel raporu indirme
- Teklif hızında yalnızca Ham Lead New Lead Arrive Time → Quoted Arrive Time; iki tarih aynı yıl ve aynı aydayken Genel/satıcı bazlı ölçüm
- Hızlı ilk açılış: sunucu başlangıcında veri ısıtma, eşzamanlı istek birleştirme ve kullanıcıyı bekletmeyen arka plan önbellek yenileme
- Yavaş Google Sheets bağlantıları için 150 saniyelik ayarlanabilir süre, gereksiz cache-busting kaldırma ve son başarılı veriye otomatik geri dönüş
- Koordinatör analizinde Genel + Ocak-Aralık dönem seçimi
- Bölüm ve doktor bazında teklif adedi, teklif tutarı, satış ve konversiyon kırılımı
- Aranabilir ve başlıklardan sıralanabilir tek koordinatör performans tablosu
- Mobil ve masaüstü görünüm iyileştirmeleri
