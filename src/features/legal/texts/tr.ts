// Review by a German lawyer before relying on this text.
// Almanca aslının çevirisidir; yalnızca Almanca sürüm hukuken bağlayıcıdır.
import type { LegalBuilder } from "../types";

export const tr: LegalBuilder = (o, ctx) => {
  const who = [o.operatorType, o.legalName].filter(Boolean).join(": ");
  const address = `${o.streetAddress}, ${o.postalCodeCity}, ${o.country}`;
  return {
    ui: {
      translationNote: "Bu sayfa, bilgilendirme amacıyla sunulan bir çeviridir. Hukuken yalnızca Almanca sürüm bağlayıcıdır.",
      germanLink: "Almanca sürüme git",
      updated: "Son güncelleme",
    },

    impressum: {
      title: "Impressum (yasal bilgiler)",
      description: "REGA Platform'un DDG madde 5 uyarınca yasal bilgileri: hizmet sağlayıcı, adres, iletişim ve ücretsiz Kürt portalının içeriğinden sorumlu kişi.",
      blocks: [
        { h: "DDG § 5 uyarınca bilgiler", p: [who, o.responsiblePerson ? `Temsile yetkili / sorumlu kişi: ${o.responsiblePerson}` : "", address].filter(Boolean) },
        { h: "İletişim", p: [`Telefon: ${o.phone}`, `E-posta: ${o.publicEmail}`] },
        ...(o.vatId || o.tradeRegister
          ? [{ h: "Sicil ve vergi", p: [o.tradeRegister ? `Ticaret sicili: ${o.tradeRegister}` : "", o.vatId ? `KDV kimlik numarası (UStG § 27a): ${o.vatId}` : ""].filter(Boolean) }]
          : []),
        { h: "İçerikten sorumlu kişi (MStV § 18 fıkra 2)", p: [`${o.responsiblePerson || o.legalName}, ${address}`] },
        { h: "Dijital Hizmetler Yasası kapsamında irtibat noktası (DSA md. 11, 12)", p: [`Makamlar, Komisyon ve kullanıcılar bize elektronik olarak ${o.publicEmail} adresinden ulaşabilir. Almanca ve İngilizce iletişim kuruyoruz.`, "Yasa dışı içerikleri “İçeriği bildir” altındaki form ile bildirebilirsiniz."] },
        { h: "Ücretsiz hizmet", p: ["REGA Platform ücretsizdir. Kullanıcılar ve işletmeler için herhangi bir ücret doğmaz."] },
        { h: "Tüketici uyuşmazlıklarının çözümü", p: ["Bir tüketici hakem kurulu önündeki uyuşmazlık çözüm süreçlerine katılmaya ne istekliyiz ne de zorunluyuz."] },
        { h: "İçeriklerden sorumluluk", p: ["İşletme, hizmet ve konum kayıtları sahipleri tarafından veya onların bilgilerine dayanarak bizim tarafımızdan oluşturulur. Hizmet sağlayıcı olarak kendi içeriklerimizden genel yasalara göre sorumluyuz. Üçüncü kişilerin içeriklerinden ancak somut bir hak ihlalinden haberdar olduğumuz andan itibaren sorumluyuz; haberdar olduğumuzda bu içerikleri derhal kaldırırız.", "REGA Asistanı'nın yapay zekâ ile oluşturulan yanıtları hatalı olabilir ve danışmanlığın yerini tutmaz."] },
        { h: "Bağlantılardan sorumluluk", p: ["Hizmetimiz, içeriği üzerinde etkimiz olmayan üçüncü kişilerin harici web sitelerine bağlantılar içerir. Bu içerikler için sorumluluk kabul etmeyiz; sorumlu her zaman ilgili sağlayıcıdır. Hak ihlallerinden haberdar olduğumuzda bu bağlantıları derhal kaldırırız."] },
        { h: "Telif hakkı", p: ["Tarafımızdan oluşturulan içerik ve eserler Alman telif hakkı yasasına tabidir. Üçüncü kişilerin katkıları ayrıca belirtilmiştir. Telif hakkı sınırlarının ötesinde çoğaltma, düzenleme ve yayma, ilgili hak sahibinin onayını gerektirir."] },
      ],
    },

    privacy: {
      title: "Gizlilik politikası",
      description: "REGA Platform gizlilik politikası: veri sorumlusu, barındırma, hesap, iletişim formu, yapay zekâ asistanı, çerezler, GDPR haklarınız ve şikâyet hakkı.",
      blocks: [
        { h: "1. Veri sorumlusu", p: ["Bu web sitesindeki veri işlemenin Genel Veri Koruma Tüzüğü (GDPR) anlamındaki sorumlusu:", `${who}, ${address}`, `E-posta: ${o.publicEmail} · Telefon: ${o.phone}`] },
        { h: "2. Genel bakış", p: ["REGA Platform, Almanya ve Avrupa'daki Kürt toplumu için ücretsiz bir rehberdir. Kişisel verileri yalnızca web sitesinin işletilmesi, kullanıcı hesabınız, sizinle iletişim ve hizmetin korunması için gerekli olduğu ölçüde işleriz. Veri satmayız; reklam veya takip ağları işletmeyiz."] },
        { h: "3. Barındırma ve sunucu günlükleri", p: [`Web sitesi ${o.hostingProvider} tarafından işletilmektedir. Siteyi açtığınızda barındırma sağlayıcısı, teknik olarak gerekli verileri (özellikle IP adresi, tarih ve saat, istenen sayfa, tarayıcı türü ve işletim sistemi) siteyi sunmak, kararlı tutmak ve saldırıları savuşturmak için işler.`, "Hukuki dayanak: GDPR md. 6/1-f (güvenli ve istikrarlı işletmede meşru menfaat). Veriler uygun güvencelerle (AB standart sözleşme hükümleri veya AB-ABD Veri Gizliliği Çerçevesi) üçüncü ülkelere aktarılabilir. Sağlayıcıyla bir veri işleme sözleşmesi bulunmaktadır."] },
        { h: "4. Çerezler ve yerel depolama", p: ["Yalnızca istediğiniz hizmet için zorunlu olan, teknik olarak gerekli depolama yöntemlerini kullanırız (TDDDG § 25/2 no. 2). Bu nedenle çerez bandı göstermiyoruz."], ul: ["Oturum çerezi (Auth.js): yalnızca giriş yaptıktan sonra, oturumunuzu sürdürür (en çok 14 gün).", "Dil çerezi (REGA_LOCALE / NEXT_LOCALE): seçtiğiniz dili hatırlar (1 yıl).", "Tarayıcı depolaması “rega-theme” (localStorage): açık/koyu temayı hatırlar.", "Tarayıcı oturum depolaması: devam eden REGA Asistanı sohbeti için rastgele bir kimlik; sekmeyi kapattığınızda silinir."] },
        { h: "5. Erişim ölçümü ve analiz", p: [ctx.analytics ? `Şu analiz aracını kullanıyoruz: ${o.analyticsTool}. Zorunlu olmayan çerezler veya benzer teknolojiler kullanılıyorsa önceden onayınızı alırız (TDDDG § 25/1, GDPR md. 6/1-a).` : "Analiz veya takip araçları kullanmıyoruz ve reklam göstermiyoruz."] },
        { h: "6. Kullanıcı hesabı ve kayıt", p: ["İşletme eklemek ve oturum gerektiren işlevler için hesap açabilirsiniz. Adınızı, e-posta adresinizi, güvenli saklanan parolanızı (karma değeri, asla düz metin değil), hesap türünü (kullanıcı veya işletme), dili, Kullanım Koşulları ve Gizlilik Politikası'nı kabul ettiğiniz zamanı, e-posta doğrulama ve son giriş zamanını işleriz.", `Doğrulama ve parola sıfırlama e-postalarını göndermek için veri işleyen olarak bir e-posta hizmet sağlayıcı kullanırız${o.emailProvider ? ` (${o.emailProvider})` : ""}.`, "Hukuki dayanak: GDPR md. 6/1-b (kullanım sözleşmesi) ve f (güvenlik, kötüye kullanımın önlenmesi). Verileri hesabınızı sildirene kadar saklarız."] },
        { h: "7. İletişim formu ve e-posta", p: ["İletişim formunu kullanırsanız adınızı, isteğe bağlı e-posta adresinizi, konuyu, mesajı ve sayfanızın dilini saklar ve mesajı ekibimize e-postayla iletiriz. Veriler yalnızca talebinizi işlemek için kullanılır (GDPR md. 6/1-b veya f) ve gerekli olmaktan çıktığında, en geç yasal saklama süreleri sonunda silinir. Spam'e karşı bağlantı başına gönderim sayısı sınırlandırılır."] },
        { h: "8. İçerik bildirimi (Dijital Hizmetler Yasası)", p: ["Bildirim formuyla bildirilen adresi, nedeni, açıklamanızı ile adınızı ve e-posta adresinizi, bildirimi değerlendirmek ve sonucu size iletmek için topluyoruz (GDPR md. 6/1-c ile DSA md. 16). Veriler, bildirimin işlenmesi ve kararın belgelenmesi için gerekli olduğu sürece saklanır."] },
        { h: "9. İşletme kayıtları", p: ["İşletme kayıtları (ad, açıklama, adres, telefon, e-posta, web sitesi, çalışma saatleri, görseller, harita konumu) herkese açık gösterilir. Kayıtları sahipleri kendileri veya onların isteğiyle ekler; bu bilgileri yayımlama yetkisinden onlar sorumludur. Görseller bir nesne depolamada saklanır. Hukuki dayanak: GDPR md. 6/1-b ve f.", "Yorumlar: Bir yorum yazarsanız, bir moderatör onayladıktan sonra hesabınızda kayıtlı adı, puanınızı, yorumunuzu ve tarihi yayımlarız. Her kullanıcı her işletme için bir yorum yazabilir; yorumu düzenleyebilir veya bize yazarak sildirebilirsiniz. Hukuki dayanak: GDPR md. 6/1-b ve f.", "İş ilanları, etkinlikler ve rehberler: Bu kayıtlar işletmeler veya ekibimiz tarafından yayımlanır. Bir işletmenin başvurular için verdiği iletişim bilgileri (e-posta adresi veya bağlantı) kayıtla birlikte herkese açık gösterilir. Hukuki dayanak: GDPR md. 6/1-b ve f."] },
        { h: "10. REGA Asistanı (yapay zekâ)", p: [`REGA Asistanı'nı kullandığınızda sorunuz, o ana kadarki konuşma ve rehberimizdeki uygun herkese açık kayıtlar yapay zekâ sağlayıcımıza iletilir: ${o.aiProvider}. Sağlayıcı verileri veri işleyen olarak işler ve üçüncü ülkelerde bulunabilir (güvence: standart sözleşme hükümleri).`, "Lütfen sohbete hassas kişisel veriler girmeyin. Yanıtlar yapay zekâ tarafından üretilir ve hatalı olabilir.", `Sohbeti rastgele bir oturum kimliğiyle (ad veya e-posta olmadan; oturum açmış kullanıcılarda hesapla ilişkilendirilerek) en çok ${ctx.aiRetentionDays} gün saklar, ardından otomatik olarak sileriz. Hukuki dayanak: GDPR md. 6/1-b ve f.`] },
        { h: "11. Konum (“Yakınımda”) ve haritalar", p: ["Yakın çevre araması konumunuzu yalnızca tarayıcınızın isteğini onaylarsanız kullanır (GDPR md. 6/1-a). Koordinatlar arama için sunucumuza iletilir ve saklanmaz. Bunun yerine bir şehir seçebilirsiniz.", "Harita karoları doğrudan bir harita hizmetinden yüklenir (varsayılan: OpenFreeMap, tiles.openfreemap.org, OpenStreetMap verilerine dayalı). Bu sırada IP adresiniz harita hizmetine iletilir (GDPR md. 6/1-f, harita gösterimi menfaati)."] },
        { h: "12. Alıcılar", p: ["Alıcılar, veri işleyenlerimiz (barındırma, e-posta gönderimi, yapay zekâ hizmeti, nesne depolama) ve yasal zorunluluk halinde makamlardır. Veriler reklam amacıyla paylaşılmaz."] },
        { h: "13. Haklarınız", p: ["Erişim (md. 15), düzeltme (md. 16), silme (md. 17), işlemenin kısıtlanması (md. 18), veri taşınabilirliği (md. 20) ve meşru menfaate dayalı işlemeye itiraz (md. 21) haklarına sahipsiniz. Verdiğiniz onayı gelecek için istediğiniz zaman geri alabilirsiniz. Bunun için " + o.publicEmail + " adresine yazın."] },
        { h: "14. Şikâyet hakkı", p: ["Bir veri koruma denetim makamına, özellikle ikamet ettiğiniz veya ihlalin gerçekleştiği iddia edilen üye devlette şikâyette bulunma hakkına sahipsiniz. Alman denetim makamlarının listesi: https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html."] },
        { h: "15. Verilerin sağlanması ve otomatik kararlar", p: ["Herkese açık sayfalar kişisel veri vermeden kullanılabilir. Hesap için ad, e-posta adresi ve parola gerekir. Profil çıkarma dâhil yalnızca otomatik karar verme yapılmaz."] },
        { h: "16. Değişiklikler", p: ["İşlevler veya hukuki durum değiştiğinde bu politikayı güncelleriz. Burada yayımlanan güncel sürüm geçerlidir."] },
      ],
    },

    terms: {
      title: "Kullanım koşulları",
      description: "REGA Platform kullanım koşulları: hiçbir ücret alınmadan ücretsiz kullanım, kayıtlar için kurallar, içerik denetimi, sorumluluk ve hesabın silinmesi.",
      blocks: [
        { h: "1. Kapsam", p: [`Bu koşullar, ${who}, ${address} tarafından işletilen REGA Platform'un (www.regaplatform.com) kullanımı için geçerlidir.`] },
        { h: "2. Ücretsiz", p: ["REGA Platform kullanıcılar ve işletmeler için tamamen ücretsizdir. Ücret, abonelik, ücretli öne çıkarma veya ödeme işlevi yoktur."] },
        { h: "3. Hesap", p: ["İşletme eklemek için hesap gerekir. Doğru bilgi vermeli, erişim bilgilerinizi gizli tutmalı ve hesabınızın kötüye kullanımını bize derhal bildirmelisiniz. Kişi başına bir hesap öngörülmüştür."] },
        { h: "4. Kayıtlar ve katkılar için kurallar", p: ["Yalnızca yayımlamaya yetkili olduğunuz içeriği ekleyebilirsiniz. Özellikle şunlara izin verilmez:"], ul: ["yasa dışı, hakaret içeren, ayrımcı veya nefret içeren içerik;", "yanlış veya yanıltıcı bilgi, uydurma işletmeler veya yorumlar;", "spam, ilgisiz tekliflerin reklamı ve aynı hizmetin yinelenen kayıtları;", "üçüncü kişilerin haklarını (telif, marka, kişilik hakları) ihlal eden içerik;", "üçüncü kişilere ilişkin, onların onayı olmadan verilen bilgiler.", "kendi deneyiminizi yansıtmayan yorumlar, kendi işletmenize yazılan yorumlar ve satın alınmış ya da karşılıklı yazılmış yorumlar;"] },
        { h: "5. İnceleme ve “Rega Verified”", p: ["Yeni kayıtlar yayımlanmadan önce tarafımızca incelenir; reddedilebilir veya düzeltme için geri gönderilebilir. “Rega Verified” işareti, kaydın belirli bilgilerini kontrol ettiğimiz anlamına gelir. Bir tavsiye değildir ve teklifin kalitesi için garanti değildir.", "Yorumlar ile iş ilanı, etkinlik ve rehber kayıtları da yalnızca inceleme sonrasında yayımlanır. Bu kuralları ihlal eden katkıları reddedebilir veya kaldırabiliriz."] },
        { h: "6. Hakların verilmesi", p: ["REGA Platform'da kayıtlarınızı ve görsellerinizi tüm dil sürümlerinde göstermemiz ve bunun için teknik olarak çoğaltmamız için bize basit, münhasır olmayan bir hak tanırsınız. Haklar sizde kalır."] },
        { h: "7. Bildirim ve kaldırma", p: ["Yasa dışı veya kurallara aykırı içerik “İçeriği bildir” ile bildirilebilir. Yasalar veya bu koşullar ihlal edilirse içeriği kaldırabilir ve hesapları engelleyebiliriz; yasanın öngördüğü ölçüde ilgilileri bilgilendirir ve gerekçeyi belirtiriz."] },
        { h: "8. Sorumluluk", p: ["Kasıt ve ağır ihmal, yaşam, beden ve sağlığın zarar görmesi ve Ürün Sorumluluğu Yasası kapsamında sınırsız sorumluyuz. Hafif ihmalde yalnızca esaslı sözleşme yükümlülüklerinin ihlalinde ve öngörülebilir, tipik zararla sınırlı olarak sorumluyuz. Kayıtlardaki bilgiler, üçüncü kişilerin teklifleri ve yapay zekâ yanıtlarının doğruluğu için garanti vermeyiz. Sürekli erişilebilirlik borcumuz yoktur."] },
        { h: "9. Hesabın silinmesi", p: [`Bize ${o.publicEmail} adresinden yazarak hesabınızı istediğiniz zaman sildirebilirsiniz. Hesap verilerinizi sileriz; yasal saklama yükümlülükleri yoksa kayıtlar kaldırılır veya anonimleştirilir.`] },
        { h: "10. Değişiklikler, uygulanacak hukuk", p: ["Bu koşulları gelecek için geçerli olmak üzere değiştirebiliriz; esaslı değişiklikleri duyururuz. Alman hukuku uygulanır; mutat meskeninizin bulunduğu devletin emredici tüketici koruma hükümleri saklıdır. Bir hüküm geçersiz olursa diğerleri geçerliliğini korur."] },
      ],
    },
  };
};
