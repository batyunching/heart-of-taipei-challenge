-- 台北之心闖關網頁
-- Migration 007: update landmark historical introductions
-- 草案日期：2026-07-11

set search_path = taipei_challenge, public, extensions;

update taipei_challenge.content_pages
set
  intro_en = '2/28 Peace Park was first developed as Taipei Park during the Japanese colonial period and later became known as New Park. It is one of the oldest modern parks in central Taipei. The park keeps traces from different times: old stone monuments, historic buildings, the National Taiwan Museum, the 2/28 Memorial Monument, and the Taipei 2/28 Memorial Museum. In 1947, the radio station in this area became connected with the spread of news during the 2/28 Incident. When you walk here, notice how a city park can also be a place for remembering history, learning about justice, and thinking about peace.',
  intro_zh = '二二八和平公園位在臺北城的核心地帶，前身是日治時期規劃的臺北公園，後來也被稱為新公園，是臺北早期重要的現代都市公園之一。園內保留了不同時代留下的痕跡，例如石坊、紀念碑、歷史建築、臺博館本館，以及二二八和平紀念碑與臺北二二八紀念館。1947 年二二八事件發生時，園內的廣播設施曾成為消息傳播的重要地點。走進這座公園，不只是看樹木與步道，也是在理解臺灣如何面對歷史傷痛、追求公義，並把記憶轉化為和平教育。對國中生來說，這裡很適合練習把「地點」和「歷史事件」連在一起思考：同一個公共空間，可能同時承載休閒、紀念、學習與反省的功能。',
  updated_at = now()
where page_key = 'peace_park';

update taipei_challenge.content_pages
set
  intro_en = 'The National Taiwan Museum is one of Taiwan''s oldest museums. Its history began in the Japanese colonial period, when exhibitions were used to collect and display Taiwan''s natural resources, industries, animals, plants, minerals, and cultures. The main building in 2/28 Peace Park was completed in 1915 and is now an important historic monument. Its classical columns, dome, and grand hall show how public buildings in Taipei were designed more than a hundred years ago. Today, the museum helps visitors understand Taiwan through natural history, anthropology, geology, animals, plants, and cultural collections. It is a good place to ask: what stories can objects tell about Taiwan?',
  intro_zh = '國立臺灣博物館是臺灣歷史最悠久的博物館之一，源頭可追溯到日治時期的物產陳列與博物館制度。現在位於二二八和平公園旁的本館建築於 1915 年完工，曾名為臺灣總督府博物館，今日已是重要的國定古蹟。它的柱廊、圓頂與中央大廳，呈現百年前臺北公共建築的氣派。館內長期保存臺灣自然史、人類學、地質、動物、植物與文化相關典藏。參觀臺博館時，可以思考：博物館為什麼要收藏標本與文物？這些物件又如何幫助我們認識臺灣的環境、族群與歷史？國中生可以特別留意展品標籤、展示分類與建築細節，因為它們會告訴我們，不同時代的人如何理解臺灣，也如何把知識整理成可以被大眾學習的內容。',
  updated_at = now()
where page_key = 'ntm_main';

update taipei_challenge.content_pages
set
  intro_en = 'The Paleontology Hall is housed in the former Nippon Kangyo Bank Taipei Branch, a historic bank building completed in 1933. After World War II, the building became connected with the Land Bank of Taiwan. Later, it was preserved and reused by the National Taiwan Museum as a branch museum. This makes the building special: it is both a place to learn about prehistoric life and a place to notice financial and architectural history. Inside, visitors can see fossils, dinosaurs, ancient animals, and displays about evolution. As you explore, look at both the exhibits and the building itself. A museum can tell stories not only through objects, but also through the space that holds them.',
  intro_zh = '古生物館所在建築原是日本勸業銀行臺北支店，1933 年落成，戰後與臺灣土地銀行的發展密切相關。後來這棟歷史建築被保存並活化，由國立臺灣博物館作為分館使用，因此它同時具有金融史、建築史與自然史的意義。走進館內，你會看到化石、恐龍、古代生物與演化相關展示；抬頭觀察，也能看見舊銀行空間的挑高感與莊重氣氛。這裡提醒我們：博物館不只是展示物品的地方，建築本身也會說故事。請一邊認識史前生命，一邊想想老建築如何被重新賦予新的教育功能。對國中生而言，這裡最有趣的是「時間尺度」的對比：古生物帶我們看見數千萬年前的地球，而銀行建築則保存近代臺北城市與金融發展的記憶。',
  updated_at = now()
where page_key = 'paleontology';

update taipei_challenge.content_pages
set
  intro_en = 'Taipei Main Station is the most important transportation hub in northern Taiwan. Railway service in this area began in 1889, and the station has changed names, locations, and buildings as Taipei grew. Today, it connects Taiwan Railways, High Speed Rail, Taipei Metro, buses, taxis, underground malls, and nearby shopping areas. Because many local and international travelers pass through every day, clear bilingual signs are very important. They help people find platforms, exits, ticket counters, restrooms, transfer routes, and safety information. When you observe the station, do not only count signs. Think about how language, design, and public space work together to help a city move.',
  intro_zh = '臺北車站是北臺灣最重要的交通樞紐之一，鐵路服務可追溯到 1889 年。隨著臺北城市發展，車站曾經歷不同名稱、位置與建築形式，今日則成為臺鐵、高鐵、捷運、公車、計程車、地下街與商圈交會的巨大交通節點。每天有大量通勤者、旅客與外國訪客在這裡移動，因此清楚的中英文標示非常重要。它們不只是翻譯文字，而是協助人們找到月台、出口、售票處、廁所、轉乘路線與安全資訊。觀察臺北車站時，請思考一座城市如何透過交通、標示與空間設計，讓不同背景的人都能順利抵達目的地。國中生可以把這裡當成一座會運轉的城市教室：人流、動線、廣播、地圖和英文標示，都是現代城市服務旅客的方式。',
  updated_at = now()
where page_key = 'taipei_station';
