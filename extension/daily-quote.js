(() => {
  'use strict';

  const ENABLED_KEY = 'dailyQuote';
  const DISMISSED_KEY = 'dailyQuoteDismissedOn';
  const MAX_BODY = 36;
  const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

  /* CATALOG_START */
  const BUNDLED_QUOTES = [
    {
      "text": "使人复结绳而用之，甘其食，美其服，安其居，乐其俗。",
      "book": "道德经",
      "chapter": "第八十章",
      "speaker": "老子",
      "id": "dq-5274ece3"
    },
    {
      "text": "居善地，心善渊，与善仁，言善信，正善治，事善能，动善时。",
      "book": "道德经",
      "chapter": "第八章",
      "speaker": "老子",
      "id": "dq-290bfbc1"
    },
    {
      "text": "水善利万物而不争，处众人之所恶，故几于道。",
      "book": "道德经",
      "chapter": "第八章",
      "speaker": "老子",
      "id": "dq-d68f6a36"
    },
    {
      "text": "为天下式，常德不忒，复归于无极。",
      "book": "道德经",
      "chapter": "第二十八章",
      "speaker": "老子",
      "id": "dq-38f90cd6"
    },
    {
      "text": "为天下溪，常德不离，复归于婴儿。",
      "book": "道德经",
      "chapter": "第二十八章",
      "speaker": "老子",
      "id": "dq-5deeb2e6"
    },
    {
      "text": "重为轻根，静为躁君。",
      "book": "道德经",
      "chapter": "第二十六章",
      "speaker": "老子",
      "id": "dq-4c27b279"
    },
    {
      "text": "不贵其师，不爱其资，虽智大迷，是谓要妙。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-156f3e7a"
    },
    {
      "text": "不善人者，善人之资。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-c40ccc80"
    },
    {
      "text": "常善救物，故无弃物，是谓袭明。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-cac31215"
    },
    {
      "text": "故善人者，不善人之师。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-62e27bf3"
    },
    {
      "text": "善闭无关楗而不可开，善结无绳约而不可解。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-56baaf23"
    },
    {
      "text": "善行无辙迹，善言无瑕讁。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-3adb8037"
    },
    {
      "text": "是以圣人常善救人，故无弃人。",
      "book": "道德经",
      "chapter": "第二十七章",
      "speaker": "老子",
      "id": "dq-ccd038d1"
    },
    {
      "text": "故从事于道者，道者同于道，德者同于德，失者同于失。",
      "book": "道德经",
      "chapter": "第二十三章",
      "speaker": "老子",
      "id": "dq-9e8c47de"
    },
    {
      "text": "同于道者，道亦乐得之。",
      "book": "道德经",
      "chapter": "第二十三章",
      "speaker": "老子",
      "id": "dq-148a3b74"
    },
    {
      "text": "同于德者，德亦乐得之。",
      "book": "道德经",
      "chapter": "第二十三章",
      "speaker": "老子",
      "id": "dq-1e5e968c"
    },
    {
      "text": "同于失者，失亦乐得之。",
      "book": "道德经",
      "chapter": "第二十三章",
      "speaker": "老子",
      "id": "dq-28d2f468"
    },
    {
      "text": "物或恶之，故有道者不处。",
      "book": "道德经",
      "chapter": "第二十四章",
      "speaker": "老子",
      "id": "dq-96d4a9da"
    },
    {
      "text": "故道大，天大，地大，王亦大。",
      "book": "道德经",
      "chapter": "第二十五章",
      "speaker": "老子",
      "id": "dq-753d0071"
    },
    {
      "text": "人法地，地法天，天法道，道法自然。",
      "book": "道德经",
      "chapter": "第二十五章",
      "speaker": "老子",
      "id": "dq-ccaa8927"
    },
    {
      "text": "道之为物，惟恍惟惚。",
      "book": "道德经",
      "chapter": "第二十一章",
      "speaker": "老子",
      "id": "dq-f29769af"
    },
    {
      "text": "孔德之容，惟道是从。",
      "book": "道德经",
      "chapter": "第二十一章",
      "speaker": "老子",
      "id": "dq-5f6d2d9b"
    },
    {
      "text": "其精甚真，其中有信。",
      "book": "道德经",
      "chapter": "第二十一章",
      "speaker": "老子",
      "id": "dq-c2b08db1"
    },
    {
      "text": "善之与恶，相去若何。",
      "book": "道德经",
      "chapter": "第二十章",
      "speaker": "老子",
      "id": "dq-53f926b3"
    },
    {
      "text": "故有无相生，难易相成，长短相较，高下相倾，音声相和，前后相随。",
      "book": "道德经",
      "chapter": "第二章",
      "speaker": "老子",
      "id": "dq-6cad7cf2"
    },
    {
      "text": "皆知善之为善，斯不善已。",
      "book": "道德经",
      "chapter": "第二章",
      "speaker": "老子",
      "id": "dq-5756d0bb"
    },
    {
      "text": "故立天子，置三公，虽有拱璧以先驷马，不如坐进此道。",
      "book": "道德经",
      "chapter": "第六十二章",
      "speaker": "老子",
      "id": "dq-9db7553a"
    },
    {
      "text": "善人之宝，不善人之所保。",
      "book": "道德经",
      "chapter": "第六十二章",
      "speaker": "老子",
      "id": "dq-2023e226"
    },
    {
      "text": "江海所以能为百谷王者，以其善下之，故能为百谷王。",
      "book": "道德经",
      "chapter": "第六十六章",
      "speaker": "老子",
      "id": "dq-8ac95a05"
    },
    {
      "text": "是以天下乐推而不厌，以其不争，故天下莫能与之争。",
      "book": "道德经",
      "chapter": "第六十六章",
      "speaker": "老子",
      "id": "dq-fd887660"
    },
    {
      "text": "天下皆谓我道大，似不肖。",
      "book": "道德经",
      "chapter": "第六十七章",
      "speaker": "老子",
      "id": "dq-abf1be56"
    },
    {
      "text": "夫轻诺必寡信，多易必多难。",
      "book": "道德经",
      "chapter": "第六十三章",
      "speaker": "老子",
      "id": "dq-7c6c3fb8"
    },
    {
      "text": "其安易持，其未兆易谋。",
      "book": "道德经",
      "chapter": "第六十四章",
      "speaker": "老子",
      "id": "dq-67d71d92"
    },
    {
      "text": "学不学，复众人之所过。",
      "book": "道德经",
      "chapter": "第六十四章",
      "speaker": "老子",
      "id": "dq-5e491152"
    },
    {
      "text": "古之善为道者，非以明民，将以愚之。",
      "book": "道德经",
      "chapter": "第六十五章",
      "speaker": "老子",
      "id": "dq-8b79bc46"
    },
    {
      "text": "玄德深矣，远矣，与物反矣，然后乃至大顺。",
      "book": "道德经",
      "chapter": "第六十五章",
      "speaker": "老子",
      "id": "dq-8f852ac1"
    },
    {
      "text": "天下之牝，牝常以静胜牡，以静为下。",
      "book": "道德经",
      "chapter": "第六十一章",
      "speaker": "老子",
      "id": "dq-8eb6c6b2"
    },
    {
      "text": "夫两不相伤，故德交归焉。",
      "book": "道德经",
      "chapter": "第六十章",
      "speaker": "老子",
      "id": "dq-ca71ff1a"
    },
    {
      "text": "人之道则不然，损不足以奉有余。",
      "book": "道德经",
      "chapter": "第七十七章",
      "speaker": "老子",
      "id": "dq-106af8b6"
    },
    {
      "text": "天之道，损有余而补不足。",
      "book": "道德经",
      "chapter": "第七十七章",
      "speaker": "老子",
      "id": "dq-c21d2284"
    },
    {
      "text": "天之道，不争而善胜，不言而善应，不召而自来，繟然而善谋。",
      "book": "道德经",
      "chapter": "第七十三章",
      "speaker": "老子",
      "id": "dq-5db79c6f"
    },
    {
      "text": "故失道而后德，失德而后仁，失仁而后义，失义而后礼。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-bfef3f6d"
    },
    {
      "text": "前识者，道之华，而愚之始。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-c03eecb3"
    },
    {
      "text": "上德不德，是以有德。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-5d5eae04"
    },
    {
      "text": "上德无为而无以为，下德为之而有以为。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-1ea65bb6"
    },
    {
      "text": "上礼为之而莫之应，则攘臂而扔之。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-14c28b76"
    },
    {
      "text": "上仁为之而无以为，上义为之而有以为。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-116454b0"
    },
    {
      "text": "下德不失德，是以无德。",
      "book": "道德经",
      "chapter": "第三十八章",
      "speaker": "老子",
      "id": "dq-fce8615b"
    },
    {
      "text": "道常无名，朴虽小，天下莫能臣也。",
      "book": "道德经",
      "chapter": "第三十二章",
      "speaker": "老子",
      "id": "dq-01d8be6d"
    },
    {
      "text": "譬道之在天下，犹川谷之于江海。",
      "book": "道德经",
      "chapter": "第三十二章",
      "speaker": "老子",
      "id": "dq-b38c7973"
    },
    {
      "text": "不欲以静，天下将自定。",
      "book": "道德经",
      "chapter": "第三十七章",
      "speaker": "老子",
      "id": "dq-b7eb1e80"
    },
    {
      "text": "知人者智，自知者明。",
      "book": "道德经",
      "chapter": "第三十三章",
      "speaker": "老子",
      "id": "dq-28650ce5"
    },
    {
      "text": "大道泛兮，其可左右。",
      "book": "道德经",
      "chapter": "第三十四章",
      "speaker": "老子",
      "id": "dq-bb620434"
    },
    {
      "text": "道之出口，淡乎其无味，视之不足见，听之不足闻，用之不足既。",
      "book": "道德经",
      "chapter": "第三十五章",
      "speaker": "老子",
      "id": "dq-8a1c8d67"
    },
    {
      "text": "善有果而已，不敢以取强。",
      "book": "道德经",
      "chapter": "第三十章",
      "speaker": "老子",
      "id": "dq-fd8ae794"
    },
    {
      "text": "物壮则老，是谓不道，不道早已。",
      "book": "道德经",
      "chapter": "第三十章",
      "speaker": "老子",
      "id": "dq-a0e588c1"
    },
    {
      "text": "知常容，容乃公，公乃全，全乃天，天乃道，道乃久，没身不殆。",
      "book": "道德经",
      "chapter": "第十六章",
      "speaker": "老子",
      "id": "dq-7fdcee4f"
    },
    {
      "text": "信不足焉，有不信焉。",
      "book": "道德经",
      "chapter": "第十七章",
      "speaker": "老子",
      "id": "dq-0d9a1eb5"
    },
    {
      "text": "能知古始，是谓道纪。",
      "book": "道德经",
      "chapter": "第十四章",
      "speaker": "老子",
      "id": "dq-1c649bd1"
    },
    {
      "text": "执古之道，以御今之有。",
      "book": "道德经",
      "chapter": "第十四章",
      "speaker": "老子",
      "id": "dq-aa05220e"
    },
    {
      "text": "保此道者不欲盈，夫唯不盈，故能蔽不新成。",
      "book": "道德经",
      "chapter": "第十五章",
      "speaker": "老子",
      "id": "dq-8cb8e4a6"
    },
    {
      "text": "古之善为士者，微妙玄通，深不可识。",
      "book": "道德经",
      "chapter": "第十五章",
      "speaker": "老子",
      "id": "dq-c33f5026"
    },
    {
      "text": "孰能安以久动之徐生。",
      "book": "道德经",
      "chapter": "第十五章",
      "speaker": "老子",
      "id": "dq-9b719b0b"
    },
    {
      "text": "明白四达，能无为乎。",
      "book": "道德经",
      "chapter": "第十章",
      "speaker": "老子",
      "id": "dq-05eecec0"
    },
    {
      "text": "生而不有，为而不恃，长而不宰，是谓玄德。",
      "book": "道德经",
      "chapter": "第十章",
      "speaker": "老子",
      "id": "dq-fa2afb87"
    },
    {
      "text": "为学日益，为道日损。",
      "book": "道德经",
      "chapter": "第四十八章",
      "speaker": "老子",
      "id": "dq-937a9409"
    },
    {
      "text": "道生一，一生二，二生三，三生万物。",
      "book": "道德经",
      "chapter": "第四十二章",
      "speaker": "老子",
      "id": "dq-7735eb78"
    },
    {
      "text": "万物负阴而抱阳，冲气以为和。",
      "book": "道德经",
      "chapter": "第四十二章",
      "speaker": "老子",
      "id": "dq-88e7e00d"
    },
    {
      "text": "不善者，吾亦善之，德善。",
      "book": "道德经",
      "chapter": "第四十九章",
      "speaker": "老子",
      "id": "dq-f092f60f"
    },
    {
      "text": "不信者，吾亦信之，德信。",
      "book": "道德经",
      "chapter": "第四十九章",
      "speaker": "老子",
      "id": "dq-2f603878"
    },
    {
      "text": "天下有道，却走马以粪。",
      "book": "道德经",
      "chapter": "第四十六章",
      "speaker": "老子",
      "id": "dq-35807538"
    },
    {
      "text": "上士闻道，勤而行之。",
      "book": "道德经",
      "chapter": "第四十一章",
      "speaker": "老子",
      "id": "dq-02fa7249"
    },
    {
      "text": "反者道之动，弱者道之用。",
      "book": "道德经",
      "chapter": "第四十章",
      "speaker": "老子",
      "id": "dq-13bc00f7"
    },
    {
      "text": "挫其锐，解其纷，和其光，同其尘，湛兮似或存。",
      "book": "道德经",
      "chapter": "第四章",
      "speaker": "老子",
      "id": "dq-abbda69a"
    },
    {
      "text": "道冲而用之或不盈，渊兮似万物之宗。",
      "book": "道德经",
      "chapter": "第四章",
      "speaker": "老子",
      "id": "dq-aa4c2c08"
    },
    {
      "text": "正复为奇，善复为妖。",
      "book": "道德经",
      "chapter": "第五十八章",
      "speaker": "老子",
      "id": "dq-1de2133d"
    },
    {
      "text": "用其光，复归其明，无遗身殃，是为习常。",
      "book": "道德经",
      "chapter": "第五十二章",
      "speaker": "老子",
      "id": "dq-c336f60d"
    },
    {
      "text": "是谓深根固柢，长生久视之道。",
      "book": "道德经",
      "chapter": "第五十九章",
      "speaker": "老子",
      "id": "dq-ba919156"
    },
    {
      "text": "重积德则无不克，无不克则莫知其极。",
      "book": "道德经",
      "chapter": "第五十九章",
      "speaker": "老子",
      "id": "dq-74cbef03"
    },
    {
      "text": "塞其兑，闭其门，挫其锐，解其分，和其光，同其尘，是谓玄同。",
      "book": "道德经",
      "chapter": "第五十六章",
      "speaker": "老子",
      "id": "dq-397e8420"
    },
    {
      "text": "大道甚夷，而民好径。",
      "book": "道德经",
      "chapter": "第五十三章",
      "speaker": "老子",
      "id": "dq-7fb99448"
    },
    {
      "text": "使我介然有知，行于大道，唯施是畏。",
      "book": "道德经",
      "chapter": "第五十三章",
      "speaker": "老子",
      "id": "dq-d3bd781a"
    },
    {
      "text": "善建者不拔，善抱者不脱，子孙以祭祀不辍。",
      "book": "道德经",
      "chapter": "第五十四章",
      "speaker": "老子",
      "id": "dq-0230bdf0"
    },
    {
      "text": "修之于国，其德乃丰。",
      "book": "道德经",
      "chapter": "第五十四章",
      "speaker": "老子",
      "id": "dq-3ef55f7d"
    },
    {
      "text": "修之于家，其德乃余。",
      "book": "道德经",
      "chapter": "第五十四章",
      "speaker": "老子",
      "id": "dq-91a9dc55"
    },
    {
      "text": "修之于身，其德乃真。",
      "book": "道德经",
      "chapter": "第五十四章",
      "speaker": "老子",
      "id": "dq-92dd531c"
    },
    {
      "text": "修之于天下，其德乃普。",
      "book": "道德经",
      "chapter": "第五十四章",
      "speaker": "老子",
      "id": "dq-80cf3348"
    },
    {
      "text": "修之于乡，其德乃长。",
      "book": "道德经",
      "chapter": "第五十四章",
      "speaker": "老子",
      "id": "dq-6ce38b72"
    },
    {
      "text": "含德之厚，比于赤子。",
      "book": "道德经",
      "chapter": "第五十五章",
      "speaker": "老子",
      "id": "dq-68298f16"
    },
    {
      "text": "物壮则老，谓之不道，不道早已。",
      "book": "道德经",
      "chapter": "第五十五章",
      "speaker": "老子",
      "id": "dq-327a2b55"
    },
    {
      "text": "终日号而不嗄，和之至也。",
      "book": "道德经",
      "chapter": "第五十五章",
      "speaker": "老子",
      "id": "dq-26b71fd7"
    },
    {
      "text": "道生之，德畜之，物形之，势成之。",
      "book": "道德经",
      "chapter": "第五十一章",
      "speaker": "老子",
      "id": "dq-011d42ea"
    },
    {
      "text": "道之尊，德之贵，夫莫之命而常自然。",
      "book": "道德经",
      "chapter": "第五十一章",
      "speaker": "老子",
      "id": "dq-ac1def52"
    },
    {
      "text": "是以万物莫不尊道而贵德。",
      "book": "道德经",
      "chapter": "第五十一章",
      "speaker": "老子",
      "id": "dq-556d4df8"
    },
    {
      "text": "道可道，非常道，名可名，非常名。",
      "book": "道德经",
      "chapter": "第一章",
      "speaker": "老子",
      "id": "dq-893fdd09"
    },
    {
      "text": "楚国无以为寳，惟善以为寳。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-371f5969"
    },
    {
      "text": "此谓诚于中，形于外，故君子必慎其独也。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-a782b39d"
    },
    {
      "text": "此谓国不以利为利，以义为利也。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-4cdaa3a5"
    },
    {
      "text": "大学之道，在明明德，在亲民，在止于至善。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-fd99bb31"
    },
    {
      "text": "道得众则得国，失众则失国。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-1bd9a988"
    },
    {
      "text": "道善则得之，不善则失之矣。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-eb98da6e"
    },
    {
      "text": "富润屋，德润身，心广体胖，故君子必诚其意。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-4cd7f921"
    },
    {
      "text": "古之欲明明德于天下者，先治其国。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-8c470144"
    },
    {
      "text": "故君子不出家而成教于国：孝者，所以事君也。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-facd9d28"
    },
    {
      "text": "君子贤其贤而亲其亲，小人乐其乐而利其利，此以没世不忘也。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-5026746b"
    },
    {
      "text": "诗云：乐只君子，民之父母。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-febcf455"
    },
    {
      "text": "诗云：穆穆文王，于缉熙敬止。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-dc4fadd9"
    },
    {
      "text": "是故君子有大道，必忠信以得之，骄泰以失之。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-f3d9edcf"
    },
    {
      "text": "未有上好仁而下不好义者也，未有好义其事不终者也，未有府库财非其财者也。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-e5d6e111"
    },
    {
      "text": "物有本末，事有终始，知所先后，则近道矣。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-62ead8a0"
    },
    {
      "text": "心诚求之，虽不中不远矣。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-b75ed85e"
    },
    {
      "text": "尧舜率天下以仁，而民从之。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-ea02878f"
    },
    {
      "text": "有德此有人，有人此有土，有土此有财，有财此有用。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-67833a04"
    },
    {
      "text": "有斐君子，终不可諠兮者，道盛德至善，民之不能忘也。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-9171481f"
    },
    {
      "text": "欲正其心者，先诚其意。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-6f6d4a21"
    },
    {
      "text": "知止而后有定，定而后能静，静而后能安，安而后能虑，虑而后能得。",
      "book": "礼记",
      "chapter": "大学",
      "id": "dq-36b213ca"
    },
    {
      "text": "博厚配地，高明配天，悠久无疆。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-7bab6cdd"
    },
    {
      "text": "博学之，审问之，慎思之，明辨之，笃行之。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-88416147"
    },
    {
      "text": "不息则久，久则征，征则悠远，悠远则博厚，博厚则高明。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-e9832f7c"
    },
    {
      "text": "诚者，物之终始，不诚无物。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-658a5dc3"
    },
    {
      "text": "诚者不勉而中，不思而得，从容中道，圣人也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-43334a03"
    },
    {
      "text": "诚者非自成己而已也，所以成物也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-6bd8777f"
    },
    {
      "text": "诚之者，择善而固执之者也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-9d670da8"
    },
    {
      "text": "道也者，不可须臾离也，可离非道也。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-4ec21067"
    },
    {
      "text": "道之不明也，我知之矣：贤者过之，不肖者不及也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-cb57caca"
    },
    {
      "text": "道之不行也，我知之矣：知者过之，愚者不及也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-67903958"
    },
    {
      "text": "德为圣人，尊为天子，富有四海之内。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-c70e79df"
    },
    {
      "text": "非天子不议礼，不制度，不考文。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-7865a20b"
    },
    {
      "text": "夫微之显，诚之不可揜，如此夫。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-a366f54b"
    },
    {
      "text": "夫孝者，善继人之志，善述人之事者也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-265bf157"
    },
    {
      "text": "苟不固聪明圣知达天德者，其孰能知之。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-a81a4099"
    },
    {
      "text": "故大德必得其位，必得其禄，必得其名，必得其寿。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-49d0f32b"
    },
    {
      "text": "故君子不动而敬，不言而信。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-56fbb51a"
    },
    {
      "text": "故君子和而不流，强哉矫。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-9f0fabc3"
    },
    {
      "text": "故君子之道，暗然而日章。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-e0e7f18f"
    },
    {
      "text": "故君子尊德性而道问学，致广大而尽精微，极高明而道中庸。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-31a34456"
    },
    {
      "text": "故为政在人，取人以身，修身以道，修道以仁。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-393e8f0f"
    },
    {
      "text": "国有道，不变塞焉，强哉矫。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-ba5fd970"
    },
    {
      "text": "果能此道矣，虽愚必明，虽柔必强。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-d1960b10"
    },
    {
      "text": "回之为人也，择乎中庸，得一善，则拳拳服膺而弗失之矣。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-9d1b5bfc"
    },
    {
      "text": "或安而行之，或利而行之，或勉强而行之。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-ae58d543"
    },
    {
      "text": "或生而知之，或学而知之，或困而知之，及其知之，一也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-ac88da31"
    },
    {
      "text": "获乎上有道，不信乎朋友，不获乎上矣。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-7724b601"
    },
    {
      "text": "见而民莫不敬，言而民莫不信，行而民莫不说。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-c3774d04"
    },
    {
      "text": "郊社之礼，所以事上帝也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-47692d9e"
    },
    {
      "text": "君子之道，造端乎夫妇，及其至也，察乎天地。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-d55e73d9"
    },
    {
      "text": "君子之道四，丘未能一焉：所求乎子，以事父，未能也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-7c4a6267"
    },
    {
      "text": "君子遵道而行，半涂而废，吾弗能已矣。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-cb53f2ac"
    },
    {
      "text": "宽柔以教，不报无道，南方之强也，君子居之。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-02e1ab18"
    },
    {
      "text": "礼仪三百，威仪三千，待其人然后行。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-d10f2e0e"
    },
    {
      "text": "明乎郊社之礼，禘尝之义，治国其如示诸掌乎。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-22adc327"
    },
    {
      "text": "齐明盛服，非礼不动，所以修身也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-fc20c913"
    },
    {
      "text": "曲能有诚，诚则形，形则著，著则明，明则动，动则变，变则化。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-dd28f4ff"
    },
    {
      "text": "去谗远色，贱货而贵德，所以劝贤也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-ddcf5120"
    },
    {
      "text": "人之为道而远人，不可以为道。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-e2546ed9"
    },
    {
      "text": "上焉者虽善无征，无征不信，不信民弗从。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-9df1ff38"
    },
    {
      "text": "诗云：予怀明德，不大声以色。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-41fca28d"
    },
    {
      "text": "使天下之人齐明盛服，以承祭祀，洋洋乎如在其上，如在其左右。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-49190193"
    },
    {
      "text": "是故君子动而世为天下道，行而世为天下法，言而世为天下则。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-27aa2107"
    },
    {
      "text": "顺乎亲有道，反诸身不诚，不顺乎亲矣。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-f0db036a"
    },
    {
      "text": "舜好问而好察迩言，隐恶而扬善，执其两端，用其中于民，其斯以为舜乎。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-a1240809"
    },
    {
      "text": "斯礼也，达乎诸侯、大夫，及士、庶人。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-2f75e9ef"
    },
    {
      "text": "虽有其德，苟无其位，亦不敢作礼乐焉。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-e2c0eaea"
    },
    {
      "text": "虽有其位，苟无其德，不敢作礼乐焉。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-8fd92bcc"
    },
    {
      "text": "所求乎朋友，先施之，未能也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-120131e3"
    },
    {
      "text": "天地之道，可壹言而尽也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-9e36ac90"
    },
    {
      "text": "天地之道：博也，厚也，高也，明也，悠也，久也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-bd020ab9"
    },
    {
      "text": "天命之谓性，率性之谓道，修道之谓教。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-68b5303b"
    },
    {
      "text": "天下之达道五，所以行之者三。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-409e53f5"
    },
    {
      "text": "万物并育而不相害，道并行而不相悖。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-4166ba0d"
    },
    {
      "text": "唯天下至诚，为能尽其性。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-7ca86d22"
    },
    {
      "text": "唯天下至诚，为能经纶天下之大经，立天下之大本，知天地之化育。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-1f14363e"
    },
    {
      "text": "唯天下至圣，为能聪明叡知，足以有临也。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-b464ec09"
    },
    {
      "text": "温故而知新，敦厚以崇礼。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-ba1dcb6e"
    },
    {
      "text": "吾学周礼，今用之，吾从周。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-f5e254b8"
    },
    {
      "text": "武王、周公，其达孝矣乎。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-890124fb"
    },
    {
      "text": "武王末受命，周公成文、武之德，追王大王、王季，上祀先公以天子之礼。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-0c464b61"
    },
    {
      "text": "下焉者虽善不尊，不尊不信，不信民弗从。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-843b2e93"
    },
    {
      "text": "小德川流，大德敦化，此天地之所以为大也。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-03dc4350"
    },
    {
      "text": "信乎朋友有道，不顺乎亲，不信乎朋友矣。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-639b9fc0"
    },
    {
      "text": "性之德也，合外内之道也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-6333414b"
    },
    {
      "text": "言前定则不跲，事前定则不困，行前定则不疚，道前定则不穷。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-4e87c8b8"
    },
    {
      "text": "有弗辨，辨之弗明弗措也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-2b7825d1"
    },
    {
      "text": "有弗学，学之弗能弗措也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-8db12690"
    },
    {
      "text": "于乎不显，文王之德之纯。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-cde46a9e"
    },
    {
      "text": "愚而好自用，贱而好自专，生乎今之世，反古之道。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-fcfb0bf8"
    },
    {
      "text": "知、仁、勇三者，天下之达德也，所以行之者一也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-3f5f664b"
    },
    {
      "text": "致中和，天地位焉，万物育焉。",
      "book": "礼记",
      "chapter": "中庸",
      "id": "dq-139e5ffc"
    },
    {
      "text": "宗庙之礼，所以祀乎其先也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-3c257dc0"
    },
    {
      "text": "宗庙之礼，所以序昭穆也。",
      "book": "礼记",
      "chapter": "中庸",
      "speaker": "孔子",
      "id": "dq-71758908"
    },
    {
      "text": "君使臣以礼，臣事君以忠。",
      "book": "论语",
      "chapter": "八佾",
      "speaker": "孔子",
      "id": "dq-b2861a93"
    },
    {
      "text": "射不主皮，为力不同科，古之道也。",
      "book": "论语",
      "chapter": "八佾",
      "speaker": "孔子",
      "id": "dq-e67e0935"
    },
    {
      "text": "天下之无道也久矣，天将以夫子为木铎。",
      "book": "论语",
      "chapter": "八佾",
      "id": "dq-01a0747b"
    },
    {
      "text": "谓武：尽美矣，未尽善也。",
      "book": "论语",
      "chapter": "八佾",
      "id": "dq-695455dc"
    },
    {
      "text": "夏礼，吾能言之，杞不足征也。",
      "book": "论语",
      "chapter": "八佾",
      "speaker": "孔子",
      "id": "dq-dcac46da"
    },
    {
      "text": "殷礼，吾能言之，宋不足征也。",
      "book": "论语",
      "chapter": "八佾",
      "speaker": "孔子",
      "id": "dq-6da96af3"
    },
    {
      "text": "子谓韶：尽美矣，又尽善也。",
      "book": "论语",
      "chapter": "八佾",
      "id": "dq-ffc2fe10"
    },
    {
      "text": "道不行，乘桴浮于海，从我者，其由与。",
      "book": "论语",
      "chapter": "公冶长",
      "speaker": "孔子",
      "id": "dq-7f15c31f"
    },
    {
      "text": "夫子之言性与天道，不可得而闻也。",
      "book": "论语",
      "chapter": "公冶长",
      "speaker": "子贡",
      "id": "dq-5a1fda11"
    },
    {
      "text": "老者安之，朋友信之，少者怀之。",
      "book": "论语",
      "chapter": "公冶长",
      "speaker": "孔子",
      "id": "dq-02e6453c"
    },
    {
      "text": "十室之邑，必有忠信如丘者焉，不如丘之好学也。",
      "book": "论语",
      "chapter": "公冶长",
      "speaker": "孔子",
      "id": "dq-f3db9fe7"
    },
    {
      "text": "始吾于人也，听其言而信其行。",
      "book": "论语",
      "chapter": "公冶长",
      "speaker": "孔子",
      "id": "dq-34dc66e0"
    },
    {
      "text": "晏平仲善与人交，久而敬之。",
      "book": "论语",
      "chapter": "公冶长",
      "speaker": "孔子",
      "id": "dq-c92131d9"
    },
    {
      "text": "夫如是，故远人不服，则修文德以来之。",
      "book": "论语",
      "chapter": "季氏",
      "speaker": "孔子",
      "id": "dq-854ebe34"
    },
    {
      "text": "乐骄乐，乐佚游，乐宴乐，损矣。",
      "book": "论语",
      "chapter": "季氏",
      "speaker": "孔子",
      "id": "dq-17c7e97d"
    },
    {
      "text": "问一得三：闻《诗》，闻礼，又闻君子之远其子也。",
      "book": "论语",
      "chapter": "季氏",
      "id": "dq-7376e3a7"
    },
    {
      "text": "益者三友，损者三友：友直，友谅，友多闻，益矣。",
      "book": "论语",
      "chapter": "季氏",
      "speaker": "孔子",
      "id": "dq-f3f5feae"
    },
    {
      "text": "友便辟，友善柔，友便佞，损矣。",
      "book": "论语",
      "chapter": "季氏",
      "speaker": "孔子",
      "id": "dq-315ee2c9"
    },
    {
      "text": "富与贵，是人之所欲也，不以其道得之，不处也。",
      "book": "论语",
      "chapter": "里仁",
      "speaker": "孔子",
      "id": "dq-7e71b102"
    },
    {
      "text": "君子无终食之闲违仁，造次必于是，颠沛必于是。",
      "book": "论语",
      "chapter": "里仁",
      "speaker": "孔子",
      "id": "dq-9e3638cc"
    },
    {
      "text": "君子之于天下也，无适也，无莫也，义之与比。",
      "book": "论语",
      "chapter": "里仁",
      "speaker": "孔子",
      "id": "dq-70ad2ae5"
    },
    {
      "text": "不义而富且贵，于我如浮云。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-aabe086e"
    },
    {
      "text": "多闻，择其善者而从之，多见而识之，知之次也。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-a556ee3f"
    },
    {
      "text": "饭疏食，飮水，曲肱而枕之，乐亦在其中矣。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-2851d421"
    },
    {
      "text": "加我数年，五十以学易，可以无大过矣。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-207fbbc4"
    },
    {
      "text": "默而识之，学而不厌，诲人不倦，何有于我哉。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-bd82ee74"
    },
    {
      "text": "述而不作，信而好古，窃比于我老彭。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-a26e4e02"
    },
    {
      "text": "天生德于予，桓魋其如予何。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-fcd788d5"
    },
    {
      "text": "择其善者而从之，其不善者而改之。",
      "book": "论语",
      "chapter": "述而",
      "speaker": "孔子",
      "id": "dq-9db11b68"
    },
    {
      "text": "子温而厉，威而不猛，恭而安。",
      "book": "论语",
      "chapter": "述而",
      "id": "dq-1b1f8fbc"
    },
    {
      "text": "子以四教：文、行、忠、信。",
      "book": "论语",
      "chapter": "述而",
      "id": "dq-606ec103"
    },
    {
      "text": "子与人歌而善，必使反之，而后和之。",
      "book": "论语",
      "chapter": "述而",
      "id": "dq-dd65b420"
    },
    {
      "text": "狂而不直，侗而不愿，悾悾而不信，吾不知之矣。",
      "book": "论语",
      "chapter": "泰伯",
      "speaker": "孔子",
      "id": "dq-45c7e3cd"
    },
    {
      "text": "三分天下有其二，以服事殷、周之德，其可谓至德也已矣。",
      "book": "论语",
      "chapter": "泰伯",
      "speaker": "孔子",
      "id": "dq-29605130"
    },
    {
      "text": "三年学，不至于谷，不易得也。",
      "book": "论语",
      "chapter": "泰伯",
      "speaker": "孔子",
      "id": "dq-598f5545"
    },
    {
      "text": "齐人归女乐，季桓子受之，三日不朝。",
      "book": "论语",
      "chapter": "微子",
      "id": "dq-85bc1c6e"
    },
    {
      "text": "枉道而事人，何必去父母之邦。",
      "book": "论语",
      "chapter": "微子",
      "id": "dq-4252aa89"
    },
    {
      "text": "直道而事人，焉往而不三黜。",
      "book": "论语",
      "chapter": "微子",
      "id": "dq-1daeaafe"
    },
    {
      "text": "赐也，女以予为多学而识之者与。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-bc946454"
    },
    {
      "text": "居是邦也，事其大夫之贤者，友其士之仁者。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-9b56b654"
    },
    {
      "text": "君子义以为质，礼以行之，孙以出之，信以成之。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-e9fdb496"
    },
    {
      "text": "群居终日，言不及义，好行小慧，难矣哉。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-eb29aaf8"
    },
    {
      "text": "斯民也，三代之所以直道而行也。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-88fc9798"
    },
    {
      "text": "行夏之时，乘殷之辂，服周之冕，乐则韶舞。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-e63c5b07"
    },
    {
      "text": "言不忠信，行不笃敬，虽州里行乎哉。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-7729e2b7"
    },
    {
      "text": "言忠信，行笃敬，虽蛮貊之邦行矣。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-2d3afdce"
    },
    {
      "text": "知及之，仁不能守之，虽得之，必失之。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-92583e85"
    },
    {
      "text": "知及之，仁能守之，庄以莅之。",
      "book": "论语",
      "chapter": "卫灵公",
      "speaker": "孔子",
      "id": "dq-d5232789"
    },
    {
      "text": "视其所以，观其所由，察其所安，人焉廋哉。",
      "book": "论语",
      "chapter": "为政",
      "speaker": "孔子",
      "id": "dq-6e11fe68"
    },
    {
      "text": "为政以德，譬如北辰，居其所，而众星共之。",
      "book": "论语",
      "chapter": "为政",
      "speaker": "孔子",
      "id": "dq-bbea1ec6"
    },
    {
      "text": "学而不思则罔，思而不学则殆。",
      "book": "论语",
      "chapter": "为政",
      "speaker": "孔子",
      "id": "dq-eba93631"
    },
    {
      "text": "殷因于夏礼，所损益可知也。",
      "book": "论语",
      "chapter": "为政",
      "speaker": "孔子",
      "id": "dq-83bf6713"
    },
    {
      "text": "周因于殷礼，所损益可知也。",
      "book": "论语",
      "chapter": "为政",
      "speaker": "孔子",
      "id": "dq-24276832"
    },
    {
      "text": "安见方六七十，如五六十，而非邦也者。",
      "book": "论语",
      "chapter": "先进",
      "id": "dq-95447b67"
    },
    {
      "text": "所谓大臣者，以道事君，不可则止。",
      "book": "论语",
      "chapter": "先进",
      "speaker": "孔子",
      "id": "dq-cca5108e"
    },
    {
      "text": "为国以礼，其言不让，是故哂之。",
      "book": "论语",
      "chapter": "先进",
      "id": "dq-8814bd60"
    },
    {
      "text": "古之学者为己，今之学者为人。",
      "book": "论语",
      "chapter": "宪问",
      "speaker": "孔子",
      "id": "dq-2d3a2ee4"
    },
    {
      "text": "可以为难矣，仁则吾不知也。",
      "book": "论语",
      "chapter": "宪问",
      "speaker": "孔子",
      "id": "dq-1b8c103d"
    },
    {
      "text": "仁者必有勇，勇者不必有仁。",
      "book": "论语",
      "chapter": "宪问",
      "speaker": "孔子",
      "id": "dq-565acb30"
    },
    {
      "text": "有德者必有言，有言者不必有德。",
      "book": "论语",
      "chapter": "宪问",
      "speaker": "孔子",
      "id": "dq-f0f1300a"
    },
    {
      "text": "道千乘之国，敬事而信，节用而爱人，使民以时。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "孔子",
      "id": "dq-9fd7b7a3"
    },
    {
      "text": "弟子入则孝，出则弟，谨而信，泛爱众，而亲仁。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "孔子",
      "id": "dq-4c6834e8"
    },
    {
      "text": "君子不重则不威，学则不固。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "孔子",
      "id": "dq-136c65dd"
    },
    {
      "text": "三年无改于父之道，可谓孝矣。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "孔子",
      "id": "dq-67dc4d4d"
    },
    {
      "text": "孝弟也者，其为仁之本与。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "有子",
      "id": "dq-12bc7875"
    },
    {
      "text": "有朋自远方来，不亦乐乎。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "孔子",
      "id": "dq-4d20c5b8"
    },
    {
      "text": "主忠信，无友不如己者，过则勿惮改。",
      "book": "论语",
      "chapter": "学而",
      "speaker": "孔子",
      "id": "dq-5c6d8f67"
    },
    {
      "text": "非礼勿视，非礼勿听，非礼勿言，非礼勿动。",
      "book": "论语",
      "chapter": "颜渊",
      "speaker": "孔子",
      "id": "dq-6619cd99"
    },
    {
      "text": "浸润之谮，肤受之愬，不行焉，可谓明也已矣。",
      "book": "论语",
      "chapter": "颜渊",
      "speaker": "孔子",
      "id": "dq-8c0c7aac"
    },
    {
      "text": "一日克己复礼，天下归仁焉，为仁由己，而由人乎哉。",
      "book": "论语",
      "chapter": "颜渊",
      "speaker": "孔子",
      "id": "dq-c5cec406"
    },
    {
      "text": "恭则不侮，宽则得众，信则人任焉，敏则有功，惠则足以使人。",
      "book": "论语",
      "chapter": "阳货",
      "id": "dq-ca696784"
    },
    {
      "text": "怀其宝而迷其邦，可谓仁乎。",
      "book": "论语",
      "chapter": "阳货",
      "id": "dq-3730f8be"
    },
    {
      "text": "食夫稻，衣夫锦，于女安乎。",
      "book": "论语",
      "chapter": "阳货",
      "speaker": "孔子",
      "id": "dq-04279a2a"
    },
    {
      "text": "宽则得众，信则民任焉，敏则有功，公则说。",
      "book": "论语",
      "chapter": "尧曰",
      "id": "dq-0aa31411"
    },
    {
      "text": "夫仁者，己欲立而立人，己欲达而达人。",
      "book": "论语",
      "chapter": "雍也",
      "speaker": "孔子",
      "id": "dq-9d8464a4"
    },
    {
      "text": "居敬而行简，以临其民，不亦可乎。",
      "book": "论语",
      "chapter": "雍也",
      "id": "dq-dcbe8d2c"
    },
    {
      "text": "君子博学于文，约之以礼，亦可以弗畔矣夫。",
      "book": "论语",
      "chapter": "雍也",
      "speaker": "孔子",
      "id": "dq-9196aee8"
    },
    {
      "text": "能近取譬，可谓仁之方也已。",
      "book": "论语",
      "chapter": "雍也",
      "speaker": "孔子",
      "id": "dq-07d76475"
    },
    {
      "text": "仁者先难而后获，可谓仁矣。",
      "book": "论语",
      "chapter": "雍也",
      "id": "dq-dcb196a8"
    },
    {
      "text": "知之者，不如好之者，好之者，不如乐之者。",
      "book": "论语",
      "chapter": "雍也",
      "speaker": "孔子",
      "id": "dq-f6f34b0e"
    },
    {
      "text": "夫子循循然善诱人：博我以文，约我以礼。",
      "book": "论语",
      "chapter": "子罕",
      "id": "dq-1a14c364"
    },
    {
      "text": "吾自衞反鲁，然后乐正，雅颂各得其所。",
      "book": "论语",
      "chapter": "子罕",
      "speaker": "孔子",
      "id": "dq-4db6223a"
    },
    {
      "text": "不如乡人之善者好之，其不善者恶之。",
      "book": "论语",
      "chapter": "子路",
      "speaker": "孔子",
      "id": "dq-b518b6e4"
    },
    {
      "text": "君子和而不同，小人同而不和。",
      "book": "论语",
      "chapter": "子路",
      "speaker": "孔子",
      "id": "dq-59de9eb9"
    },
    {
      "text": "如其善而莫之违也，不亦善乎。",
      "book": "论语",
      "chapter": "子路",
      "speaker": "孔子",
      "id": "dq-44124d7a"
    },
    {
      "text": "言必信，行必果，硁硁然，小人哉，抑亦可以为次矣。",
      "book": "论语",
      "chapter": "子路",
      "id": "dq-834a8a5f"
    },
    {
      "text": "百工居肆以成其事，君子学以致其道。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子夏",
      "id": "dq-a5b884f2"
    },
    {
      "text": "博学而笃志，切问而近思，仁在其中矣。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子夏",
      "id": "dq-da5282b9"
    },
    {
      "text": "大德不逾闲，小德出入可也。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子夏",
      "id": "dq-b8e99777"
    },
    {
      "text": "君子信而后劳其民，未信则以为厉己也。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子夏",
      "id": "dq-717566c1"
    },
    {
      "text": "君子尊贤而容众，嘉善而矜不能。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子张",
      "id": "dq-2901e6eb"
    },
    {
      "text": "虽小道，必有可观者焉，致远恐泥，是以君子不为也。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子夏",
      "id": "dq-7264d853"
    },
    {
      "text": "堂堂乎张也，难与并为仁矣。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "曾子",
      "id": "dq-7a14c4a2"
    },
    {
      "text": "文、武之道，未坠于地，在人。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子贡",
      "id": "dq-1b076eb9"
    },
    {
      "text": "贤者识其大者，不贤者识其小者，莫不有文、武之道焉。",
      "book": "论语",
      "chapter": "子张",
      "speaker": "子贡",
      "id": "dq-6db393b4"
    },
    {
      "text": "故有物必有则，民之秉彝也，故好是懿德。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "孟子",
      "id": "dq-c89e58d9"
    },
    {
      "text": "今之为仁者，犹以一杯水救一车薪之火也。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "孟子",
      "id": "dq-23d617f9"
    },
    {
      "text": "人性之无分于善不善也，犹水之无分于东西也。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "告子",
      "id": "dq-5cfe7657"
    },
    {
      "text": "仁义礼智，非由外铄我也，我固有之也，弗思耳矣。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "孟子",
      "id": "dq-ada2e754"
    },
    {
      "text": "如有能信之者，则不远秦、楚之路，为指之不若人也。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "孟子",
      "id": "dq-bebe05fc"
    },
    {
      "text": "万钟则不辨礼义而受之，万钟于我何加焉。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "孟子",
      "id": "dq-29e32897"
    },
    {
      "text": "言饱乎仁义也，所以不愿人之膏粱之味也。",
      "book": "孟子",
      "chapter": "告子上",
      "speaker": "孟子",
      "id": "dq-d8b74a72"
    },
    {
      "text": "夫茍好善，则四海之内，皆将轻千里而来告之以善。",
      "book": "孟子",
      "chapter": "告子下",
      "id": "dq-5ab7ce98"
    },
    {
      "text": "夫子在三卿之中，名实未加于上下而去之，仁者固如此乎。",
      "book": "孟子",
      "chapter": "告子下",
      "id": "dq-8b86ee38"
    },
    {
      "text": "君子之事君也，务引其君以当道，志于仁而已。",
      "book": "孟子",
      "chapter": "告子下",
      "id": "dq-64611fc4"
    },
    {
      "text": "其次，虽未行其言也，迎之致敬以有礼，则就之。",
      "book": "孟子",
      "chapter": "告子下",
      "speaker": "孟子",
      "id": "dq-ad99b9fe"
    },
    {
      "text": "其兄关弓而射之，则己垂涕泣而道之，无他，戚之也。",
      "book": "孟子",
      "chapter": "告子下",
      "id": "dq-0fb951a8"
    },
    {
      "text": "取色之重者与礼之轻者而比之，奚翅色重。",
      "book": "孟子",
      "chapter": "告子下",
      "speaker": "孟子",
      "id": "dq-2dcb2cd6"
    },
    {
      "text": "取食之重者与礼之轻者而比之，奚翅食重。",
      "book": "孟子",
      "chapter": "告子下",
      "speaker": "孟子",
      "id": "dq-818fe818"
    },
    {
      "text": "由今之道，无变今之俗，虽与之天下，不能一朝居也。",
      "book": "孟子",
      "chapter": "告子下",
      "speaker": "孟子",
      "id": "dq-b2e48f41"
    },
    {
      "text": "有人于此，越人关弓而射之，则己谈笑而道之。",
      "book": "孟子",
      "chapter": "告子下",
      "id": "dq-d9cd4d38"
    },
    {
      "text": "大舜有大焉，善与人同，舍己从人，乐取于人以为善。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "speaker": "孟子",
      "id": "dq-3e27fa7e"
    },
    {
      "text": "当今之时，万乘之国行仁政，民之悦之，犹解倒悬也。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "id": "dq-b940bf86"
    },
    {
      "text": "地不改辟矣，民不改聚矣，行仁政而王，莫之能御也。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "id": "dq-f0ed6211"
    },
    {
      "text": "夫子加齐之卿相，得行道焉，虽由此霸王不异矣。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "id": "dq-e1a2473a"
    },
    {
      "text": "且以文王之德，百年而后崩，犹未洽于天下。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "id": "dq-bf269197"
    },
    {
      "text": "信能行此五者，则邻国之民仰之若父母矣。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "speaker": "孟子",
      "id": "dq-8e130d99"
    },
    {
      "text": "以德服人者，中心悦而诚服也，如七十子之服孔子也。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "speaker": "孟子",
      "id": "dq-906fcfdc"
    },
    {
      "text": "以德行仁者王，王不待大，汤以七十里，文王以百里。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "speaker": "孟子",
      "id": "dq-6d9baee6"
    },
    {
      "text": "宰我、子贡善为说辞，冉牛、闵子、颜渊善言德行。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "id": "dq-951ba2e8"
    },
    {
      "text": "纣之去武丁未久也，其故家遗俗、流风善政，犹有存者。",
      "book": "孟子",
      "chapter": "公孙丑上",
      "id": "dq-8de6176a"
    },
    {
      "text": "朝廷莫如爵，乡党莫如齿，辅世长民莫如德。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-ec0ef0ab"
    },
    {
      "text": "固将朝也，闻王命而遂不果，宜与夫礼若不相似然。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "speaker": "景子",
      "id": "dq-14926692"
    },
    {
      "text": "故汤之于伊尹，学焉而后臣之，故不劳而王。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-35fba86b"
    },
    {
      "text": "桓公之于管仲，学焉而后臣之，故不劳而霸。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-cc259f8c"
    },
    {
      "text": "齐人无以仁义与王言者，岂以仁义为不美也。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-340459cb"
    },
    {
      "text": "我非尧舜之道不敢以陈于王前，故齐人莫如我敬王也。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-7b64269c"
    },
    {
      "text": "我明语子：昔者鲁缪公无人乎子思之侧，则不能安子思。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-228881b1"
    },
    {
      "text": "泄柳、申详无人乎缪公之侧，则不能安其身。",
      "book": "孟子",
      "chapter": "公孙丑下",
      "id": "dq-82eb5ec1"
    },
    {
      "text": "道则高矣、美矣，宜若登天然，似不可及也。",
      "book": "孟子",
      "chapter": "尽心上",
      "id": "dq-1d864e2a"
    },
    {
      "text": "孩提之童，无不知爱其亲者，及其长也，无不知敬其兄也。",
      "book": "孟子",
      "chapter": "尽心上",
      "speaker": "孟子",
      "id": "dq-40f6ef37"
    },
    {
      "text": "及其闻一善言，见一善行，若决江河，沛然莫之能御也。",
      "book": "孟子",
      "chapter": "尽心上",
      "speaker": "孟子",
      "id": "dq-96948ec5"
    },
    {
      "text": "窃负而逃，遵海滨而处，终身欣然，乐而忘天下。",
      "book": "孟子",
      "chapter": "尽心上",
      "id": "dq-64730c74"
    },
    {
      "text": "求之有道，得之有命，是求无益于得也，求在外者也。",
      "book": "孟子",
      "chapter": "尽心上",
      "speaker": "孟子",
      "id": "dq-3995c043"
    },
    {
      "text": "行之而不著焉，习矣而不察焉，终身由之而不知其道者，众也。",
      "book": "孟子",
      "chapter": "尽心上",
      "speaker": "孟子",
      "id": "dq-2663a1c0"
    },
    {
      "text": "中天下而立，定四海之民，君子乐之，所性不存焉。",
      "book": "孟子",
      "chapter": "尽心上",
      "speaker": "孟子",
      "id": "dq-f4fceee0"
    },
    {
      "text": "仲子，不义与之齐国而弗受，人皆信之，是舍箪食豆羹之义也。",
      "book": "孟子",
      "chapter": "尽心上",
      "speaker": "孟子",
      "id": "dq-c207e030"
    },
    {
      "text": "般乐饮酒，驱骋田猎，后车千乘，我得志弗为也。",
      "book": "孟子",
      "chapter": "尽心下",
      "speaker": "孟子",
      "id": "dq-d138de15"
    },
    {
      "text": "既竭心思焉，继之以不忍人之政而仁覆天下矣。",
      "book": "孟子",
      "chapter": "离娄上",
      "speaker": "孟子",
      "id": "dq-dee9f822"
    },
    {
      "text": "今天下之君有好仁者，则诸侯皆为之駆矣。",
      "book": "孟子",
      "chapter": "离娄上",
      "speaker": "孟子",
      "id": "dq-4059f609"
    },
    {
      "text": "君仁莫不仁，君义莫不义，君正莫不正，一正君而国定矣。",
      "book": "孟子",
      "chapter": "离娄上",
      "speaker": "孟子",
      "id": "dq-17f157f4"
    },
    {
      "text": "求也，为季氏宰，无能改于其德，而赋粟倍他日。",
      "book": "孟子",
      "chapter": "离娄上",
      "speaker": "孟子",
      "id": "dq-27ca6f23"
    },
    {
      "text": "事君无义，进退无礼，言则非先王之道者，犹沓沓也。",
      "book": "孟子",
      "chapter": "离娄上",
      "speaker": "孟子",
      "id": "dq-6c9b2cbe"
    },
    {
      "text": "不足，又顾而之他──此其为餍足之道也。",
      "book": "孟子",
      "chapter": "离娄下",
      "id": "dq-ac490781"
    },
    {
      "text": "大人者，言不必信，行不必果，惟义所在。",
      "book": "孟子",
      "chapter": "离娄下",
      "speaker": "孟子",
      "id": "dq-c42c632c"
    },
    {
      "text": "礼：朝庭不历位而相与言，不逾阶而相揖也。",
      "book": "孟子",
      "chapter": "离娄下",
      "id": "dq-73bbe76b"
    },
    {
      "text": "中也养不中，才也养不才，故人乐有贤父兄也。",
      "book": "孟子",
      "chapter": "离娄下",
      "speaker": "孟子",
      "id": "dq-cca32c70"
    },
    {
      "text": "自得之则居之安，居之安则资之深，资之深则取之左右逢其原。",
      "book": "孟子",
      "chapter": "离娄下",
      "speaker": "孟子",
      "id": "dq-547d7483"
    },
    {
      "text": "诚如是也，民归之，由水之就下，沛然谁能御之。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "id": "dq-70888a66"
    },
    {
      "text": "古之人所以大过人者，无他焉，善推其所为而已矣。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "id": "dq-f430abfc"
    },
    {
      "text": "谨庠序之教，申之以孝悌之义，颁白者不负戴于道路矣。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "id": "dq-bebf7462"
    },
    {
      "text": "是故明君制民之产，必使仰足以事父母，俯足以畜妻子。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "id": "dq-be72c8b1"
    },
    {
      "text": "未有仁而遗其亲者也，未有义而后其君者也。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "speaker": "孟子",
      "id": "dq-c1b62de3"
    },
    {
      "text": "仲尼之徒，无道桓、文之事者，是以后世无传焉。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "speaker": "孟子",
      "id": "dq-41a79964"
    },
    {
      "text": "壮者以暇日修其孝悌忠信，入以事其父兄，出以事其长上。",
      "book": "孟子",
      "chapter": "梁惠王上",
      "speaker": "孟子",
      "id": "dq-1515b997"
    },
    {
      "text": "寡人非能好先王之乐也，直好世俗之乐耳。",
      "book": "孟子",
      "chapter": "梁惠王下",
      "id": "dq-b19ccb01"
    },
    {
      "text": "惟仁者为能以大事小，是故汤事葛，文王事昆夷。",
      "book": "孟子",
      "chapter": "梁惠王下",
      "speaker": "孟子",
      "id": "dq-4cf4ac51"
    },
    {
      "text": "惟智者为能以小事大，故太王事獯鬻，勾践事吴。",
      "book": "孟子",
      "chapter": "梁惠王下",
      "speaker": "孟子",
      "id": "dq-7027508b"
    },
    {
      "text": "分人以财谓之惠，教人以善谓之忠，为天下得人者谓之仁。",
      "book": "孟子",
      "chapter": "滕文公上",
      "id": "dq-31844f8f"
    },
    {
      "text": "夫夷子信以为人之亲其兄之子为若亲其邻之赤子乎。",
      "book": "孟子",
      "chapter": "滕文公上",
      "speaker": "孟子",
      "id": "dq-fad20218"
    },
    {
      "text": "今滕绝长补短，将五十里也，犹可以为善国。",
      "book": "孟子",
      "chapter": "滕文公上",
      "speaker": "孟子",
      "id": "dq-72c05630"
    },
    {
      "text": "民之为道也，有恒产者有恒心，无恒产者无恒心。",
      "book": "孟子",
      "chapter": "滕文公上",
      "speaker": "孟子",
      "id": "dq-35d3d097"
    },
    {
      "text": "人之有道也，饱食煖衣，逸居而无教，则近于禽兽。",
      "book": "孟子",
      "chapter": "滕文公上",
      "id": "dq-b8a361dc"
    },
    {
      "text": "儒者之道，古之人若保赤子，此言何谓也。",
      "book": "孟子",
      "chapter": "滕文公上",
      "speaker": "夷子",
      "id": "dq-7bce1156"
    },
    {
      "text": "远方之人，闻君行仁政，愿受一廛而为氓。",
      "book": "孟子",
      "chapter": "滕文公上",
      "id": "dq-6ca4c383"
    },
    {
      "text": "悦周公、仲尼之道，北学于中国，北方之学者，未能或之先也。",
      "book": "孟子",
      "chapter": "滕文公上",
      "id": "dq-557f1f58"
    },
    {
      "text": "治于人者食人，治人者食于人──天下之通义也。",
      "book": "孟子",
      "chapter": "滕文公上",
      "id": "dq-1e15a922"
    },
    {
      "text": "子之君将行仁政，选择而使子，子必勉之。",
      "book": "孟子",
      "chapter": "滕文公上",
      "speaker": "孟子",
      "id": "dq-e3222969"
    },
    {
      "text": "居天下之广居，立天下之正位，行天下之大道。",
      "book": "孟子",
      "chapter": "滕文公下",
      "speaker": "孟子",
      "id": "dq-fee1945e"
    },
    {
      "text": "如其道，则舜受尧之天下，不以为泰，子以为泰乎。",
      "book": "孟子",
      "chapter": "滕文公下",
      "speaker": "孟子",
      "id": "dq-2c4423ef"
    },
    {
      "text": "入则孝，出则悌，守先王之道，以待后之学者，而不得食于子。",
      "book": "孟子",
      "chapter": "滕文公下",
      "id": "dq-099c2f5d"
    },
    {
      "text": "我明告子：有楚大夫于此，欲其子之齐语也，则使齐人傅诸。",
      "book": "孟子",
      "chapter": "滕文公下",
      "id": "dq-ed5cb35d"
    },
    {
      "text": "杨墨之道不息，孔子之道不著，是邪说诬民、充塞仁义也。",
      "book": "孟子",
      "chapter": "滕文公下",
      "id": "dq-a2dd322e"
    },
    {
      "text": "在王所者，长幼卑尊皆非薛居州也，王谁与为善。",
      "book": "孟子",
      "chapter": "滕文公下",
      "id": "dq-48b1bcd4"
    },
    {
      "text": "大孝终身慕父母，五十而慕者，予于大舜见之矣。",
      "book": "孟子",
      "chapter": "万章上",
      "id": "dq-e034cadf"
    },
    {
      "text": "非其义也，非其道也，禄之以天下弗顾也，系马千驷弗视也。",
      "book": "孟子",
      "chapter": "万章上",
      "speaker": "孟子",
      "id": "dq-798ca812"
    },
    {
      "text": "非其义也，非其道也，一介不以与人，一介不以取诸人。",
      "book": "孟子",
      "chapter": "万章上",
      "speaker": "孟子",
      "id": "dq-4aa963e1"
    },
    {
      "text": "匹夫而有天下者，德必若舜禹，而又有天子荐之者。",
      "book": "孟子",
      "chapter": "万章上",
      "speaker": "孟子",
      "id": "dq-e615447d"
    },
    {
      "text": "人有言至于禹而德衰，不传于贤而传于子，有诸。",
      "book": "孟子",
      "chapter": "万章上",
      "id": "dq-fd4627d5"
    },
    {
      "text": "时举于秦，知缪公之可与有行也而相之，可谓不智乎。",
      "book": "孟子",
      "chapter": "万章上",
      "speaker": "孟子",
      "id": "dq-6365f9dc"
    },
    {
      "text": "使之主事而事治，百姓安之，是民受之也。",
      "book": "孟子",
      "chapter": "万章上",
      "id": "dq-0d784a9f"
    },
    {
      "text": "我岂若处畎亩之中，由是以乐尧舜之道哉。",
      "book": "孟子",
      "chapter": "万章上",
      "speaker": "孟子",
      "id": "dq-3729ff91"
    },
    {
      "text": "语云：盛德之士，君不得而臣，父不得而子。",
      "book": "孟子",
      "chapter": "万章上",
      "id": "dq-dd172b81"
    },
    {
      "text": "当纣之时，居北海之滨，以待天下之清也。",
      "book": "孟子",
      "chapter": "万章下",
      "speaker": "孟子",
      "id": "dq-8b2c5573"
    },
    {
      "text": "茍善其礼际矣，斯君子受之，敢问何说也。",
      "book": "孟子",
      "chapter": "万章下",
      "id": "dq-e21172f2"
    },
    {
      "text": "其交也以道，其接也以礼，斯孔子受之矣。",
      "book": "孟子",
      "chapter": "万章下",
      "id": "dq-951f63d1"
    },
    {
      "text": "千乘之君求与之友，而不可得也，而况可召与。",
      "book": "孟子",
      "chapter": "万章下",
      "id": "dq-d6c86950"
    },
    {
      "text": "献子之与此五人者友也，无献子之家者也。",
      "book": "孟子",
      "chapter": "万章下",
      "speaker": "孟子",
      "id": "dq-c4acccfc"
    },
    {
      "text": "欲见贤人而不以其道，犹欲其入而闭之门也。",
      "book": "孟子",
      "chapter": "万章下",
      "id": "dq-260bdd4e"
    },
    {
      "text": "子思以为鼎肉使己仆仆尔亟拜也，非养君子之道也。",
      "book": "孟子",
      "chapter": "万章下",
      "id": "dq-713e3843"
    }
  ];
  /* CATALOG_END */

  function localDateKey(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function dayOfYear(date) {
    const year = date.getFullYear();
    const start = new Date(year, 0, 1);
    const current = new Date(year, date.getMonth(), date.getDate());
    return Math.round((current.getTime() - start.getTime()) / 86400000) + 1;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleYear(quotes, year) {
    const list = quotes.slice();
    const rand = mulberry32(year);
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      const swap = list[i];
      list[i] = list[j];
      list[j] = swap;
    }
    return list;
  }

  function quoteForDate(quotes, date) {
    if (!quotes || !quotes.length) return null;
    const order = shuffleYear(quotes, date.getFullYear());
    const index = (dayOfYear(date) - 1) % order.length;
    return order[index];
  }

  function sourceLine(quote) {
    const work = '《' + quote.book + '·' + quote.chapter + '》';
    return quote.speaker ? quote.speaker + '·' + work : work;
  }

  function bodyLength(text) {
    return Array.from(String(text)).length;
  }

  function validateQuotes(quotes) {
    const errors = [];
    if (!Array.isArray(quotes)) {
      errors.push('catalog must be an array');
      return errors;
    }
    const ids = new Set();
    const texts = new Set();
    for (let i = 0; i < quotes.length; i += 1) {
      const quote = quotes[i];
      const where = 'quote[' + i + ']';
      if (!quote || typeof quote !== 'object') {
        errors.push(where + ' must be an object');
        continue;
      }
      if (typeof quote.id !== 'string' || !quote.id.trim()) errors.push(where + ' missing id');
      else if (ids.has(quote.id)) errors.push(where + ' duplicate id ' + quote.id);
      else ids.add(quote.id);
      if (typeof quote.text !== 'string' || !quote.text) errors.push(where + ' missing text');
      else {
        const n = bodyLength(quote.text);
        if (n > MAX_BODY) errors.push(where + ' text length ' + n);
        if (texts.has(quote.text)) errors.push(where + ' duplicate text');
        else texts.add(quote.text);
      }
      if (typeof quote.book !== 'string' || !quote.book.trim()) errors.push(where + ' missing book');
      if (typeof quote.chapter !== 'string' || !quote.chapter.trim()) errors.push(where + ' missing chapter');
      if (quote.speaker != null && quote.speaker !== '' && (typeof quote.speaker !== 'string' || !quote.speaker.trim())) {
        errors.push(where + ' speaker must be a non-empty string');
      }
      if (quote.book && quote.chapter) {
        const line = sourceLine({
          book: quote.book,
          chapter: quote.chapter,
          speaker: typeof quote.speaker === 'string' ? quote.speaker : '',
        });
        if (!(/^[\u4e00-\u9fff]{1,8}·《[\u4e00-\u9fff]{1,8}·[\u4e00-\u9fff]{1,12}》$/.test(line) || /^《[\u4e00-\u9fff]{1,8}·[\u4e00-\u9fff]{1,12}》$/.test(line))) {
          errors.push(where + ' bad source format');
        }
      }
    }
    return errors;
  }

  function parseCatalog(raw) {
    const errors = validateQuotes(raw);
    if (errors.length) {
      const err = new Error(errors[0]);
      err.errors = errors;
      throw err;
    }
    return raw.map((quote) => {
      const parsed = {
        id: quote.id,
        text: quote.text,
        book: quote.book,
        chapter: quote.chapter,
      };
      if (typeof quote.speaker === 'string' && quote.speaker.trim()) parsed.speaker = quote.speaker;
      return parsed;
    });
  }

  function normalizeDismissed(value) {
    return typeof value === 'string' && DATE_KEY.test(value) ? value : '';
  }

  function readPrefs(data) {
    const row = data || {};
    return {
      enabled: row[ENABLED_KEY] === true,
      dismissedOn: normalizeDismissed(row[DISMISSED_KEY]),
    };
  }

  function decidePhase(prefs, today) {
    if (!prefs || prefs.enabled !== true) return 'off';
    if (prefs.dismissedOn === today) return 'dismissed';
    return 'shown';
  }

  function msUntilNextLocalTick(now) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1, 0);
    const delta = next.getTime() - now.getTime();
    return delta > 0 ? delta : 1000;
  }

  function intersectionArea(a, b) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (!(w > 0) || !(h > 0)) return 0;
    return w * h;
  }

  function createDailyQuote(options) {
    const doc = options.document;
    const storage = options.storage;
    const catalog = options.catalog;
    const now = options.now || (() => new Date());
    const schedule = options.schedule || ((fn, ms) => setTimeout(fn, ms));
    const cancel = options.cancel || ((id) => clearTimeout(id));
    let prefs = { enabled: false, dismissedOn: '' };
    let timer = null;
    let listening = false;
    let resizeObserver = null;
    let mutationObserver = null;
    let onResize = null;
    let rafId = 0;
    let started = false;

    function todayKey() {
      return localDateKey(now());
    }

    function desk() {
      return doc.querySelector('.studio-desk');
    }

    function card() {
      return doc.getElementById('daily-quote');
    }

    function toggle() {
      return doc.getElementById('daily-quote-toggle');
    }

    function syncToggle() {
      const box = toggle();
      if (!box) return;
      const want = prefs.enabled === true;
      if (box.checked !== want) box.checked = want;
    }

    function disarm() {
      if (timer == null) return;
      cancel(timer);
      timer = null;
    }

    function disconnectWatch() {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }
      if (onResize) {
        doc.defaultView.removeEventListener('resize', onResize);
        onResize = null;
      }
      if (rafId && doc.defaultView.cancelAnimationFrame) {
        doc.defaultView.cancelAnimationFrame(rafId);
      }
      rafId = 0;
    }

    function removeCard() {
      const node = card();
      if (node && node.parentNode) node.parentNode.removeChild(node);
      if (doc.body) doc.body.classList.remove('dq-on');
      disconnectWatch();
    }

    function isRendered(node) {
      if (!node || node.nodeType !== 1) return false;
      const view = node.ownerDocument && node.ownerDocument.defaultView;
      let current = node;
      while (current && current.nodeType === 1) {
        if (current.hidden) return false;
        let display = '';
        let visibility = '';
        if (view && typeof view.getComputedStyle === 'function') {
          const cs = view.getComputedStyle(current);
          if (cs) {
            display = cs.display || '';
            visibility = cs.visibility || '';
          }
        } else if (current.style) {
          display = current.style.display || '';
          visibility = current.style.visibility || '';
        }
        if (display === 'none' || visibility === 'hidden') return false;
        current = current.parentNode;
      }
      return true;
    }

    function focusResume() {
      const title = doc.getElementById('resume-title');
      const section = doc.getElementById('resume');
      const target = title && isRendered(title) ? title : section;
      if (!target) return;
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      if (typeof target.focus === 'function') target.focus({ preventScroll: true });
    }

    function renderCard(quote) {
      const host = desk();
      if (!host || !quote) return;
      if (doc.body) doc.body.classList.add('dq-on');
      let node = card();
      if (!node) {
        node = doc.createElement('figure');
        node.id = 'daily-quote';
        node.className = 'dq dq-v2';
        node.setAttribute('aria-label', '每日一句');
        const text = doc.createElement('blockquote');
        text.className = 'dq-text';
        const src = doc.createElement('figcaption');
        src.className = 'dq-src';
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'dq-x';
        button.setAttribute('aria-label', '今天不再显示');
        const mark = doc.createElement('span');
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = '×';
        button.appendChild(mark);
        button.addEventListener('click', () => dismissToday(true));
        node.appendChild(text);
        node.appendChild(src);
        node.appendChild(button);
        host.appendChild(node);
      }
      node.hidden = false;
      node.querySelector('.dq-text').textContent = quote.text;
      node.querySelector('.dq-src').textContent = sourceLine(quote);
      connectWatch();
      queueCollide();
    }

    function apply() {
      const phase = decidePhase(prefs, todayKey());
      syncToggle();
      if (phase !== 'shown') {
        disarm();
        removeCard();
        return;
      }
      renderCard(quoteForDate(catalog, now()));
      armMidnight();
    }

    function armMidnight() {
      disarm();
      timer = schedule(() => {
        timer = null;
        apply();
      }, msUntilNextLocalTick(now()));
    }

    function queueCollide() {
      const view = doc.defaultView;
      if (!view || typeof view.requestAnimationFrame !== 'function') {
        updateCollide();
        return;
      }
      if (rafId) return;
      rafId = view.requestAnimationFrame(() => {
        rafId = 0;
        updateCollide();
      });
    }

    function cardRect(node) {
      const collided = node.classList.contains('dq-collide');
      if (collided) node.classList.remove('dq-collide');
      const rect = node.getBoundingClientRect();
      if (collided) node.classList.add('dq-collide');
      return rect;
    }

    function updateCollide() {
      const node = card();
      if (!node || !node.parentNode) return;
      if (typeof node.getBoundingClientRect !== 'function') return;
      const rect = cardRect(node);
      if (!(rect.width > 0) || !(rect.height > 0)) {
        if (node.classList.contains('dq-collide')) node.classList.remove('dq-collide');
        return;
      }
      const hits = collectOverlap(doc, node, rect);
      const hit = hits.total > 0;
      const has = node.classList.contains('dq-collide');
      if (hit && !has) node.classList.add('dq-collide');
      else if (!hit && has) node.classList.remove('dq-collide');
    }

    function connectWatch() {
      if (onResize || typeof doc.defaultView !== 'object' || !doc.defaultView) return;
      const view = doc.defaultView;
      onResize = () => queueCollide();
      if (view.addEventListener) view.addEventListener('resize', onResize);
      const main = doc.getElementById('main');
      if (main && typeof view.ResizeObserver === 'function') {
        resizeObserver = new view.ResizeObserver(() => queueCollide());
        resizeObserver.observe(main);
      }
      const host = desk();
      if (host && typeof view.MutationObserver === 'function') {
        mutationObserver = new view.MutationObserver(() => queueCollide());
        mutationObserver.observe(host, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
        });
      }
    }

    async function dismissToday(moveFocus) {
      const key = todayKey();
      prefs = { enabled: prefs.enabled === true, dismissedOn: key };
      disarm();
      removeCard();
      syncToggle();
      if (moveFocus) focusResume();
      if (storage && storage.local) await storage.local.set({ [DISMISSED_KEY]: key });
    }

    function onStorage(changes, area) {
      if (area !== 'local' || !changes) return;
      if (!(ENABLED_KEY in changes) && !(DISMISSED_KEY in changes)) return;
      if (ENABLED_KEY in changes) prefs.enabled = changes[ENABLED_KEY].newValue === true;
      if (DISMISSED_KEY in changes) prefs.dismissedOn = normalizeDismissed(changes[DISMISSED_KEY].newValue);
      apply();
    }

    async function start() {
      if (started) {
        apply();
        return;
      }
      started = true;
      const box = toggle();
      if (box && !box.dataset.dqBound) {
        box.dataset.dqBound = '1';
        box.addEventListener('change', () => {
          prefs = { enabled: box.checked === true, dismissedOn: prefs.dismissedOn };
          if (storage && storage.local) storage.local.set({ [ENABLED_KEY]: prefs.enabled === true });
          apply();
        });
      }
      if (storage && storage.onChanged && !listening) {
        storage.onChanged.addListener(onStorage);
        listening = true;
      }
      doc.addEventListener('visibilitychange', () => {
        if (!doc.hidden) apply();
      });
      if (storage && storage.local) {
        try {
          const data = await storage.local.get({ [ENABLED_KEY]: false, [DISMISSED_KEY]: '' });
          prefs = readPrefs(data);
        } catch {
          prefs = { enabled: false, dismissedOn: '' };
        }
      }
      apply();
    }

    return {
      start,
      apply,
      dismissToday,
      phase() { return decidePhase(prefs, todayKey()); },
    };
  }

  function shownElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.hidden) return false;
    const view = el.ownerDocument && el.ownerDocument.defaultView;
    if (!view || typeof view.getComputedStyle !== 'function') return true;
    const cs = view.getComputedStyle(el);
    if (!cs) return true;
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    return true;
  }

  function collectOverlap(doc, card, cardRect) {
    const main = doc.getElementById('main');
    const hits = [];
    let total = 0;
    let checked = 0;
    if (!main || !card || typeof main.querySelectorAll !== 'function') {
      return { total, hits, checked };
    }
    const boxSelector = 'a, button, input, textarea, select, img, svg, .col, .tile, .studio-nav, .studio-brand';
    const nodes = main.querySelectorAll('*');
    for (let i = 0; i < nodes.length; i += 1) {
      const el = nodes[i];
      if (el === card || card.contains(el) || el.contains(card)) continue;
      if (typeof el.closest === 'function' && el.closest('[hidden]')) continue;
      if (!shownElement(el)) continue;
      if (typeof el.matches === 'function' && el.matches('.stars-layer')) continue;
      if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') {
        const inControl = typeof el.closest === 'function' && el.closest('button, a');
        if (!inControl) continue;
      }
      const useBox = (typeof el.matches === 'function' && el.matches(boxSelector)) || el.childElementCount === 0;
      const rects = [];
      if (useBox && typeof el.getClientRects === 'function') {
        const list = el.getClientRects();
        for (let r = 0; r < list.length; r += 1) rects.push(list[r]);
      } else if (el.childNodes) {
        for (let n = 0; n < el.childNodes.length; n += 1) {
          const child = el.childNodes[n];
          if (!child || child.nodeType !== 3 || !String(child.textContent || '').trim()) continue;
          if (typeof doc.createRange !== 'function') continue;
          const range = doc.createRange();
          range.selectNodeContents(child);
          const list = range.getClientRects();
          for (let r = 0; r < list.length; r += 1) rects.push(list[r]);
        }
      }
      let area = 0;
      for (let r = 0; r < rects.length; r += 1) {
        const rect = rects[r];
        if (!(rect.width >= 1) || !(rect.height >= 1)) continue;
        checked += 1;
        area += intersectionArea(cardRect, rect);
      }
      if (area > 0) {
        total += area;
        const label = (el.id ? el.tagName.toLowerCase() + '#' + el.id : el.tagName.toLowerCase());
        hits.push({ label, area });
      }
    }
    return { total, hits, checked };
  }

  function boot() {
    if (typeof document === 'undefined' || !document.documentElement) return;
    let catalog;
    try {
      catalog = parseCatalog(BUNDLED_QUOTES);
    } catch {
      return;
    }
    const storage = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage : null;
    const daily = createDailyQuote({
      document,
      storage,
      catalog,
    });
    daily.start();
  }

  const api = {
    ENABLED_KEY,
    DISMISSED_KEY,
    MAX_BODY,
    BUNDLED_QUOTES,
    localDateKey,
    dayOfYear,
    shuffleYear,
    quoteForDate,
    sourceLine,
    bodyLength,
    validateQuotes,
    parseCatalog,
    readPrefs,
    decidePhase,
    msUntilNextLocalTick,
    intersectionArea,
    collectOverlap,
    createDailyQuote,
  };

  if (typeof window !== 'undefined') window.SopifyDailyQuote = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document !== 'undefined' && document.documentElement) boot();
})();
