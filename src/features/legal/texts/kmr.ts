// Review by a German lawyer before relying on this text.
// Werger ji nivîsa orîjînal a Almanî ye; tenê guhertoya Almanî ji aliyê hiqûqî ve girêdayî ye.
import type { LegalBuilder } from "../types";

export const kmr: LegalBuilder = (o, ctx) => {
  const who = [o.operatorType, o.legalName].filter(Boolean).join(": ");
  const address = `${o.streetAddress}, ${o.postalCodeCity}, ${o.country}`;
  return {
    ui: {
      translationNote: "Ev rûpel wergerek e û tenê ji bo agahdariya te ye. Ji aliyê hiqûqî ve tenê guhertoya Almanî girêdayî ye.",
      germanLink: "Here guhertoya Almanî",
      updated: "Nûkirina dawî",
    },

    impressum: {
      title: "Impressum (agahiya yasayî)",
      description: "Agahiya yasayî ya REGA Platform li gorî xala 5 a DDG: pêşkêşvan, navnîşan, têkilî û berpirsê naveroka vê portala kurdî ya bêpere.",
      blocks: [
        { h: "Agahî li gorî § 5 DDG", p: [who, o.responsiblePerson ? `Nûner / kesê berpirs: ${o.responsiblePerson}` : "", address].filter(Boolean) },
        { h: "Têkilî", p: [`Telefon: ${o.phone}`, `E-name: ${o.publicEmail}`] },
        ...(o.vatId || o.tradeRegister
          ? [{ h: "Qeyd û bac", p: [o.tradeRegister ? `Qeyda bazirganî: ${o.tradeRegister}` : "", o.vatId ? `Hejmara naskirina baca zêdekirî (§ 27a UStG): ${o.vatId}` : ""].filter(Boolean) }]
          : []),
        { h: "Berpirsê naverokê (§ 18 xala 2 MStV)", p: [`${o.responsiblePerson || o.legalName}, ${address}`] },
        { h: "Xala têkiliyê li gorî Qanûna Karûbarên Dîjîtal (Mad. 11, 12 DSA)", p: [`Desthilat, Komîsyon û bikarhêner dikarin bi elektronîkî bi me re li ${o.publicEmail} têkilî daynin. Em bi Almanî û Îngilîzî diaxivin.`, "Naveroka neqanûnî bi forma di bin «Naverokê raporî bike» de dikare bê ragihandin."] },
        { h: "Karûbarê bêpere", p: ["REGA Platform bêpere ye. Ji bo bikarhêner û karsazan tu mesref çênabe."] },
        { h: "Çareserkirina nakokiyên xerîdaran", p: ["Em ne amade ne û ne jî mecbûr in ku beşdarî rêgezên çareserkirina nakokiyê li ber lijneyek lihevkirinê ya xerîdaran bibin."] },
        { h: "Berpirsiyariya naverokê", p: ["Tomarên karsaz, karûbar û cihan ji aliyê xwediyên wan an ji aliyê me ve li ser bingeha agahiyên wan têne çêkirin. Wekî pêşkêşvanê karûbarê, em li gorî qanûnên giştî ji bo naveroka xwe berpirs in. Ji bo naveroka kesên din em tenê ji dema ku em ji binpêkirineke diyar haydar bibin berpirs in; wê demê em wê naverokê tavilê jê dibin.", "Bersivên Alîkarê REGA yên ku bi zîrekiya çêkirî têne çêkirin dikarin şaş bin û şûna şîretê nagirin."] },
        { h: "Berpirsiyariya lînkan", p: ["Karûbarê me lînkên malperên derveyî yên aliyên sêyem dihewîne ku em bandorê li naveroka wan nakin. Em ji bo wê naverokê berpirsiyariyê napejirînin; berpirs her gav pêşkêşvanê têkildar e. Gava em ji binpêkirinan haydar bibin, em wan lînkan tavilê jê dibin."] },
        { h: "Mafê çapê", p: ["Naverok û berhemên ku em çêdikin bin qanûna mafê çapê ya Almanyayê ne. Beşdariyên aliyên sêyem wekî wiha hatine nîşankirin. Kopîkirin, sererastkirin û belavkirina ji sînorên qanûna mafê çapê wêdetir razîbûna xwediyê mafê hewce dike."] },
      ],
    },

    privacy: {
      title: "Siyaseta nepenîtiyê",
      description: "Siyaseta nepenîtiyê ya REGA Platform: berpirsê daneyan, mêvandarî, hesab, forma têkiliyê, alîkarê AI, cookie û mafên te li gorî GDPR û mafê giliyê.",
      blocks: [
        { h: "1. Berpirsê daneyan", p: ["Berpirsê hilanîna daneyan li ser vê malperê, di wateya Rêziknameya Giştî ya Parastina Daneyan (GDPR) de, ev e:", `${who}, ${address}`, `E-name: ${o.publicEmail} · Telefon: ${o.phone}`] },
        { h: "2. Çavdêriyek giştî", p: ["REGA Platform rêbereke bêpere ye ji bo civaka kurd li Almanya û Ewropayê. Em daneyên kesane tenê di wê astê de dihilînin ku ji bo xebata malperê, hesabê te, danûstandina bi te re û parastina karûbarê pêwîst e. Em dane nafroşin û tu tora reklam an şopandinê nagerînin."] },
        { h: "3. Mêvandarî û tomarên serverê", p: [`Malper li ${o.hostingProvider} tê xebitandin. Gava tu malperê vedikî, pêşkêşvanê mêvandariyê daneyên ji aliyê teknîkî ve pêwîst dihilîne, bi taybetî navnîşana IP, roj û demjimêr, rûpela daxwazkirî, cureya gerokê û pergala xebitandinê; ji bo pêşkêşkirina malperê, aramiyê û berevaniya li dijî êrîşan.`, "Bingeha hiqûqî: Mad. 6(1)(f) GDPR (berjewendiya rewa ya xebateke ewle û aram). Daneyan dibe ku bi garantiyên guncan (bendên peymanê yên standard yên YE an Çarçoveya Nepenîtiya Daneyan YE-DYE) bên şandin welatên sêyem. Bi pêşkêşvan re peymana hilanîna daneyan heye."] },
        { h: "4. Cookie û hilanîna herêmî", p: ["Em tenê hilanînên ji aliyê teknîkî ve pêwîst bikar tînin ku ji bo karûbarê daxwazkirî hewce ne (§ 25(2) hejmar 2 TDDDG). Ji ber vê yekê em bannera cookie nîşan nadin."], ul: ["Cookiya danişînê (Auth.js): tenê piştî têketinê, danişîna te diparêze (heya 14 roj).", "Cookiya zimanê (REGA_LOCALE / NEXT_LOCALE): zimanê te tîne bîra xwe (1 sal).", "Hilanîna gerokê «rega-theme» (localStorage): moda ronî/tarî tîne bîra xwe.", "Hilanîna danişîna gerokê: nasnameyeke rasthatî ji bo çeta Alîkarê REGA ya heyî; gava tu tabê digirî tê jêbirin."] },
        { h: "5. Pîvandina gihîştinê û analîz", p: [ctx.analytics ? `Em ev amûra analîzê bikar tînin: ${o.analyticsTool}. Heke ew cookie an teknolojiyên wekhev ên ne pêwîst bikar bîne, em berî wê razîbûna te digirin (§ 25(1) TDDDG, Mad. 6(1)(a) GDPR).` : "Em amûrên analîz an şopandinê bikar naynin û reklam nîşan nadin."] },
        { h: "6. Hesabê bikarhêner û tomarkirin", p: ["Tu dikarî ji bo tomarkirina karsaziyê û taybetmendiyên bi têketinê hesabek çêkî. Em nav, navnîşana e-nameyê, şîfreyeke bi ewlehî hatî tomarkirin (hash, qet ne nivîsa vekirî), cureya hesabê (bikarhêner an karsaz), ziman, dema qebûlkirina Mercên Bikaranînê û Siyaseta Nepenîtiyê, dema pejirandina e-nameyê û têketina dawî dihilînin.", `Ji bo şandina e-nameyên pejirandin û vesazkirina şîfreyê em pêşkêşvanek karûbarê e-nameyê wekî hilanînkar bikar tînin${o.emailProvider ? ` (${o.emailProvider})` : ""}.`, "Bingeha hiqûqî: Mad. 6(1)(b) GDPR (peymana bikaranînê) û (f) (ewlehî, pêşîlêgirtina xirabkariyê). Em daneyan heya tu hesabê xwe jê bidî diparêzin."] },
        { h: "7. Forma têkiliyê û e-name", p: ["Heke tu forma têkiliyê bikar bînî, em nav, bi dilxwazî e-name, mijar, peyam û zimanê rûpela te tomar dikin û peyamê bi e-nameyê ji tîma xwe re dişînin. Dane tenê ji bo bersivdana daxwaza te têne bikaranîn (Mad. 6(1)(b) an (f) GDPR) û gava êdî ne pêwîst bin têne jêbirin, herî dereng piştî dawiya demên parastinê yên qanûnî. Ji bo parastina li dijî spamê hejmara şandinan ji bo her girêdanê tê sînorkirin."] },
        { h: "8. Raporkirina naverokê (Qanûna Karûbarên Dîjîtal)", p: ["Bi forma raporê em navnîşana raporkirî, sedem, ravekirina te û nav û e-nameya te top dikin da ku rapor binirxînin û encamê ji te re bibêjin (Mad. 6(1)(c) GDPR bi Mad. 16 DSA re). Dane heya ku ji bo birêvebirina raporê û belgekirina biryarê pêwîst be têne parastin."] },
        { h: "9. Tomarên karsazan", p: ["Tomarên karsazan (nav, danasîn, navnîşan, telefon, e-name, malper, demjimêrên xebatê, wêne, cihê li ser nexşeyê) bi giştî têne nîşandan. Ew ji aliyê xwediyên xwe an bi daxwaza wan têne tomarkirin; ew berpirs in ku mafê weşandina van agahiyan hebe. Wêne di depoyeke tiştan de têne hilanîn. Bingeha hiqûqî: Mad. 6(1)(b) û (f) GDPR.", "Nirxandin: heke tu nirxandinekê binivîsî, piştî ku moderatorek erê bike, em navê di hesabê te de hatiye tomarkirin, stêrkan, şîroveya te û dîrokê diweşînin. Her bikarhêner dikare ji bo her karsazekî nirxandinek binivîsîne; tu dikarî wê biguherînî an bi nivîsandina ji me re jê bibî. Bingeha hiqûqî: Mad. 6(1)(b) û (f) GDPR.", "Kar, bûyer û rêbername: ev tomar ji aliyê karsazan an tîma me ve têne weşandin. Agahiyên têkiliyê yên ku karsazek ji bo serlêdanê dide (e-name an girêdan) bi tomarê re bi giştî têne nîşandan. Bingeha hiqûqî: Mad. 6(1)(b) û (f) GDPR."] },
        { h: "10. Alîkarê REGA (AI)", p: [`Gava tu Alîkarê REGA bikar tînî, pirsa te, axaftina heta niha û tomarên giştî yên guncan ên ji rêbera me ji pêşkêşvanê me yê AI re têne şandin: ${o.aiProvider}. Pêşkêşvan daneyan wekî hilanînkar dişopîne û dibe ku li welatên sêyem be (garantî: bendên peymanê yên standard).`, "Ji kerema xwe daneyên kesane yên hesas nenivîse nav çetê. Bersiv ji aliyê AI ve têne çêkirin û dikarin şaş bin.", `Em çetê bi nasnameyeke danişîna rasthatî (bê nav an e-name; ji bo bikarhênerên têketî bi hesabê ve girêdayî) herî zêde ${ctx.aiRetentionDays} roj diparêzin û paşê bi xwe jê dibin. Bingeha hiqûqî: Mad. 6(1)(b) û (f) GDPR.`] },
        { h: "11. Cih («Nêzîk») û nexşe", p: ["Lêgerîna nêzîk cihê te tenê gava bikar tîne ku tu daxwaza gerokê bipejirînî (Mad. 6(1)(a) GDPR). Koordînat ji bo lêgerînê ji serverê me re têne şandin û nayên hilanîn. Tu dikarî li şûna wê bajarekî hilbijêrî.", "Kaşiyên nexşeyê rasterast ji karûbarekî nexşeyê têne barkirin (standard: OpenFreeMap, tiles.openfreemap.org, li ser bingeha daneyên OpenStreetMap). Di vê demê de navnîşana IP ya te ji karûbarê nexşeyê re tê şandin (Mad. 6(1)(f) GDPR, berjewendiya nîşandana nexşeyê)."] },
        { h: "12. Wergir", p: ["Wergir hilanînkarên me ne (mêvandarî, şandina e-nameyê, karûbarê AI, depoya tiştan) û heke bi qanûnê pêwîst be desthilat. Dane ji bo armancên reklamê nayên dayîn."] },
        { h: "13. Mafên te", p: ["Mafê te heye ku tu agahî (Mad. 15), serastkirin (16), jêbirin (17), sînorkirina hilanînê (18), veguhastina daneyan (20) û îtîraz li hilanînên li ser bingeha berjewendiyên rewa (21 GDPR) bixwazî. Tu dikarî razîbûna xwe her dem ji bo pêşerojê vekşînî. Ji bo vê ji " + o.publicEmail + " re binivîse."] },
        { h: "14. Mafê giliyê", p: ["Mafê te heye ku tu li ba desthilateke çavdêriyê ya parastina daneyan gilî bikî, bi taybetî li dewleta endam a ku tu lê dijî an lê binpêkirina îdiakirî çêbûye. Lîsteya desthilatên Almanyayê: https://www.bfdi.bund.de/DE/Service/Anschriften/Laender/Laender-node.html."] },
        { h: "15. Peydakirina daneyan û biryarên otomatîk", p: ["Rûpelên giştî bê dayîna daneyên kesane dikarin bên bikaranîn. Ji bo hesabekê nav, e-name û şîfre pêwîst in. Biryargirtina tenê otomatîk, tevî profîlkirinê, çênabe."] },
        { h: "16. Guhertin", p: ["Gava taybetmendî an rewşa qanûnî biguhere, em vê siyasetê nû dikin. Guhertoya li vir hatî weşandin derbasdar e."] },
      ],
    },

    terms: {
      title: "Mercên bikaranînê",
      description: "Mercên bikaranînê yên REGA Platform: bikaranîna bêpere bê mesref, rêgezên tomaran, çavdêrî, berpirsiyarî û jêbirina hesabê.",
      blocks: [
        { h: "1. Qada derbasdariyê", p: [`Ev merc ji bo bikaranîna REGA Platform (www.regaplatform.com) derbasdar in, ku ji aliyê ${who}, ${address} ve tê xebitandin.`] },
        { h: "2. Bêpere", p: ["REGA Platform ji bo bikarhêner û karsazan bi temamî bêpere ye. Mesref, abonetî, cihên bi pere an taybetmendiyên dayînê tune ne."] },
        { h: "3. Hesab", p: ["Ji bo tomarkirina karsaziyê hesab pêwîst e. Divê tu agahiyên rast bidî, agahiyên têketinê veşartî bihêlî û her xirabkariya hesabê xwe tavilê ji me re bibêjî. Ji bo her kesî yek hesab tê bihesibandin."] },
        { h: "4. Rêgezên tomar û beşdariyan", p: ["Tu tenê dikarî naveroka ku mafê te yê weşandinê heye biweşînî. Bi taybetî ev tişt qedexe ne:"], ul: ["naveroka neqanûnî, heqaretkar, cudakar an nefretê belavker;", "agahiyên derew an xapînok, karsaz an nirxandinên çêkirî;", "spam, reklama pêşniyarên negirêdayî û tomarên dubare yên heman karûbarê;", "naveroka ku mafên aliyên sêyem (mafê çapê, marqe, mafên kesane) binpê dike;", "agahiyên li ser kesên din bê razîbûna wan;", "nirxandinên ku ne ji ezmûna te ne, nirxandinên karsaziya xwe, û nirxandinên kirrîn an guhertî."] },
        { h: "5. Kontrol û «Rega Verified»", p: ["Tomarên nû berî weşandinê ji aliyê me ve têne kontrolkirin û dikarin bên red kirin an ji bo sererastkirinê vegerin. Nîşana «Rega Verified» tê wê wateyê ku me hin agahiyên tomarê kontrol kirine. Ew ne pêşniyar û ne jî garantiya kalîteya pêşniyarê ye.", "Nirxandin û tomarên kar, bûyer û rêbernameyan jî tenê piştî kontrolê têne weşandin. Em dikarin beşdariyên ku van rêgezan binpê dikin red bikin an rakin."] },
        { h: "6. Dayîna mafan", p: ["Tu mafekî sade û ne-taybet dide me ku em tomar û wêneyên te li ser REGA Platform bi hemû zimanan nîşan bidin û ji bo wê armancê ji aliyê teknîkî ve kopî bikin. Maf li cem te dimînin."] },
        { h: "7. Raporkirin û rakirin", p: ["Naveroka neqanûnî an ya li dijî rêgezan dikare bi «Naverokê raporî bike» bê raporkirin. Heke qanûn an ev merc werin binpêkirin, em dikarin naverokê rakin û hesaban bigirin; em kesên têkildar agahdar dikin û sedemê dibêjin heya ku qanûn pêşbîn dike."] },
        { h: "8. Berpirsiyarî", p: ["Em ji bo qesta bi mebest û nezanîna giran, ji bo zirara li jiyan, laş û tenduristiyê û li gorî Qanûna Berpirsiyariya Hilberê bê sînor berpirs in. Di nezanîna sivik de em tenê ji bo binpêkirina peywirên peymanê yên bingehîn û heya zirara pêşbînkirî û tîpîk berpirs in. Em ji bo agahiyên tomaran, pêşniyarên aliyên sêyem û rastiya bersivên AI garantiyê nadin. Em ne deyndarê berdestbûna domdar in."] },
        { h: "9. Jêbirina hesabê", p: [`Tu dikarî her dem bi nivîsandina ji me re li ${o.publicEmail} jêbirina hesabê xwe bixwazî. Em daneyên hesabê te jê dibin; tomar têne rakirin an bênav kirin heya ku peywirên parastina qanûnî nebin asteng.`] },
        { h: "10. Guhertin, qanûna derbasdar", p: ["Em dikarin van mercan ji bo pêşerojê biguherînin; guhertinên girîng em radigihînin. Qanûna Almanyayê derbasdar e; rêgezên girêdayî yên parastina xerîdaran ên dewleta ku tu lê dijî nayên guhertin. Heke xalek betal bibe, yên din derbasdar dimînin."] },
      ],
    },
  };
};
