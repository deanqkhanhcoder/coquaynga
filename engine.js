// ENGINE START — logic thuần, không phụ thuộc DOM.
// answer: A=0, B=1, C=2, D=3.
const ITEMS={
  glass:{name:'Kính lúp',desc:'Xem viên đạn hiện tại.'},
  cigarette:{name:'Thuốc lá',desc:'Hồi 1 HP, tối đa 3 HP.'},
  saw:{name:'Cưa tay',desc:'Tăng sát thương phát bắn kế tiếp lên 2 HP.'},
  beer:{name:'Chai bia',desc:'Bỏ viên đạn hiện tại, không mất lượt.'},
  cuffs:{name:'Còng tay',desc:'Tổ còn sống kế tiếp bỏ qua một lượt.'}
};

const QUESTIONS = [
  {
    "text": "Biến điệu biên độ là gì?",
    "options": [
      "Trộn sóng âm tần có tần số rất lớn với sóng mang có tần số thấp.",
      "Là kĩ thuật trộn tín hiệu âm tần vào sóng mang sao cho biên độ của sóng mang thay đổi theo biên độ của sóng âm tần, trong khi tần số và pha giữ nguyên.",
      "Biến đổi sóng điện từ thành sóng cơ học để truyền đi xa.",
      "Tách sóng âm tần ra khỏi sóng cao tần ở máy thu."
    ],
    "answer": 1
  },
  {
    "text": "Mục đích chính của quá trình biến điệu biên độ (AM) sóng điện từ là gì?",
    "options": [
      "Làm giảm năng lượng của sóng mang để tiết kiệm điện.",
      "Trộn tín hiệu tần số thấp với sóng mang tần số cao để truyền đi xa.",
      "Biến sóng âm thành sóng siêu âm.",
      "Làm cho biên độ sóng mang trở nên cố định không đổi."
    ],
    "answer": 1
  },
  {
    "text": "Trong biến điệu biên độ (AM), đại lượng nào của sóng mang thay đổi theo biên độ của sóng âm tần?",
    "options": [
      "Tần số",
      "Pha",
      "Biên độ",
      "Cả biên độ, tần số và pha"
    ],
    "answer": 2
  },
  {
    "text": "Trong quá trình biến điệu AM, tần số của sóng mang có đặc điểm gì?",
    "options": [
      "Biến thiên tuần hoàn theo tín hiệu âm tần.",
      "Tăng lên liên tục theo thời gian.",
      "Không thay đổi (giữ nguyên tần số của sóng mang ban đầu).",
      "Giảm về bằng 0."
    ],
    "answer": 2
  },
  {
    "text": "Trong biến điệu tần số (FM), đại lượng nào của sóng mang thay đổi theo biên độ của sóng âm tần?",
    "options": [
      "Biên độ không đổi, tần số thay đổi",
      "Biên độ thay đổi, tần số không đổi",
      "Cả biên độ và tần số đều thay đổi",
      "Cả biên độ và tần số đều không đổi"
    ],
    "answer": 0
  },
  {
    "text": "Dải tần số dành cho sóng phát thanh AM (Biến điệu biên độ) thường nằm trong khoảng nào?",
    "options": [
      "88 MHz – 108 MHz",
      "526,5 kHz – 1606,5 kHz",
      "Từ vài Hz đến vài kHz",
      "Trên 1000 MHz"
    ],
    "answer": 1
  },
  {
    "text": "Ưu điểm lớn nhất của sóng phát thanh FM so với sóng AM là gì?",
    "options": [
      "Phạm vi phủ sóng rộng lớn hơn",
      "Chất lượng tín hiệu tốt hơn và ít bị nhiễu hơn",
      "Cần băng thông nhỏ hơn",
      "Máy thu thiết kế đơn giản và rẻ tiền hơn"
    ],
    "answer": 1
  },
  {
    "text": "Nếu khoảng cách kênh là 0,2 MHz thì sẽ có bao nhiêu kênh FM trong dải từ 88 MHz đến 108 MHz?",
    "options": [
      "50 kênh",
      "80 kênh",
      "100 kênh",
      "120 kênh"
    ],
    "answer": 2
  },
  {
    "text": "Trong dải tần số từ 526,5 kHz đến 1606,5 kHz với độ dài mỗi kênh là 9 kHz. Vậy có bao nhiêu kênh radio AM?",
    "options": [
      "90 kênh",
      "100 kênh",
      "120 kênh",
      "150 kênh"
    ],
    "answer": 2
  },
  {
    "text": "Nhược điểm lớn nhất của hệ thống truyền thông sử dụng biến điệu biên độ (AM) so với biến điệu tần số (FM) là gì?",
    "options": [
      "Yêu cầu băng thông truyền dẫn lớn hơn đáng kể",
      "Mạch thu phát vô tuyến cực kỳ phức tạp và đắt tiền",
      "Không thể truyền tải tín hiệu đi xa qua tầng điện ly",
      "Dễ bị ảnh hưởng và gây nhiễu bởi các tạp âm biên độ (nhiễu khí quyển, tia lửa điện)"
    ],
    "answer": 3
  },
  {
    "text": "Một đài phát thanh AM phát tín hiệu âm thanh có tần số cao nhất là 9 kHz. Băng thông (<i>B</i>) tối thiểu cần thiết để truyền tải kênh phát thanh này là bao nhiêu?",
    "options": [
      "4,5 kHz",
      "9 kHz",
      "18 kHz",
      "36 kHz"
    ],
    "answer": 2
  },
  {
    "text": "Một sóng mang có tần số 800 kHz được biến điệu biên độ bởi một tín hiệu âm tần hình sin có tần số 5 kHz. Tần số của dải biên trên và dải biên dưới lần lượt là:",
    "options": [
      "805 kHz và 800 kHz",
      "805 kHz và 795 kHz",
      "810 kHz và 790 kHz",
      "400 kHz và 200 kHz"
    ],
    "answer": 1
  },
  {
    "text": "Nhược điểm của sóng biến điệu tần số (FM) so với sóng biến điệu biên độ (AM) là:",
    "options": [
      "Dễ bị nhiễu tạp âm hơn",
      "Diện tích phủ sóng nhỏ hơn và đòi hỏi băng thông rộng hơn",
      "Chất lượng âm thanh kém hơn",
      "Không thể truyền đi xa qua tầng điện ly"
    ],
    "answer": 1
  },
  {
    "text": "Một kênh truyền thanh sử dụng sóng FM tại Việt Nam (ví dụ VOV Giao thông) thường hoạt động ở dải tần số khoảng:",
    "options": [
      "526,5 kHz – 1606,5 kHz",
      "Khoảng 88 MHz – 108 MHz",
      "10 kHz – 50 kHz",
      "1 GHz – 10 GHz"
    ],
    "answer": 1
  },
  {
    "text": "Khi tín hiệu âm tần có biên độ bằng 0 (không có âm thanh), sóng AM truyền đi trong không gian sẽ có đặc điểm gì?",
    "options": [
      "Biên độ bằng 0",
      "Biên độ không đổi và bằng biên độ ban đầu của sóng mang",
      "Tần số của sóng giảm đi một nửa",
      "Sóng ngừng truyền phát hoàn toàn"
    ],
    "answer": 1
  },
  {
    "text": "Một tín hiệu thông tin điều chế có tần số tối đa <i>f</i><sub>m</sub> = 4 kHz được dùng để biến điệu biên độ một sóng mang có tần số <i>f</i><sub>c</sub> = 100 kHz. Các tần số biên trên (USB) và tần số biên dưới (LSB) của tín hiệu AM tương ứng là bao nhiêu?",
    "options": [
      "USB = 96 kHz, LSB = 104 kHz",
      "USB = 100 kHz, LSB = 4 kHz",
      "USB = 104 kHz, LSB = 96 kHz",
      "USB = 104 kHz, LSB = 100 kHz"
    ],
    "answer": 2
  },
  {
    "text": "Trong điều chế biên độ (AM), nếu tần số sóng mang là <i>f</i><sub>c</sub>, tần số tín hiệu âm tần là <i>f</i><sub>m</sub>, tần số dải biên trên (USB) được xác định bằng công thức nào?",
    "options": [
      "<i>f</i><sub>c</sub> − <i>f</i><sub>m</sub>",
      "<i>f</i><sub>c</sub> + <i>f</i><sub>m</sub>",
      "<i>f</i><sub>c</sub> × <i>f</i><sub>m</sub>",
      "<i>f</i><sub>c</sub> / <i>f</i><sub>m</sub>"
    ],
    "answer": 1
  },
  {
    "text": "Một sóng mang có tần số 1 MHz được biến điệu biên độ bởi tín hiệu âm tần có tần số 6 kHz. Tần số dải biên trên và dải biên dưới lần lượt là bao nhiêu?",
    "options": [
      "1006 kHz và 994 kHz",
      "1006 kHz và 1000 kHz",
      "1000 kHz và 994 kHz",
      "1012 kHz và 988 kHz"
    ],
    "answer": 0
  },
  {
    "text": "Một tín hiệu âm tần có tần số lớn nhất là 5 kHz được dùng để điều chế AM. Băng thông tối thiểu của tín hiệu AM là bao nhiêu?",
    "options": [
      "2,5 kHz",
      "5 kHz",
      "10 kHz",
      "15 kHz"
    ],
    "answer": 2
  },
  {
    "text": "Trong điều chế AM lý tưởng, khi biên độ tín hiệu âm tần tăng lên thì đại lượng nào của sóng mang biến đổi tương ứng?",
    "options": [
      "Tần số sóng mang tăng lên.",
      "Pha sóng mang thay đổi liên tục.",
      "Biên độ của sóng mang thay đổi theo tín hiệu âm tần.",
      "Tần số và pha của sóng mang đồng thời thay đổi."
    ],
    "answer": 2
  },
  {
    "text": "Một máy phát FM có tần số sóng mang trung tâm là 100 MHz. Khi tín hiệu âm tần thay đổi, tần số tức thời của sóng phát có thể biến đổi như thế nào?",
    "options": [
      "Luôn bằng 100 MHz.",
      "Biến đổi quanh 100 MHz theo tín hiệu điều chế.",
      "Luôn giảm xuống dưới 100 MHz.",
      "Biến đổi từ 0 đến 100 MHz."
    ],
    "answer": 1
  },
  {
    "text": "Vì sao sóng FM thường ít bị ảnh hưởng bởi nhiễu khí quyển hơn sóng AM?",
    "options": [
      "Vì sóng FM không truyền năng lượng.",
      "Vì sóng FM có tần số luôn thấp hơn sóng AM.",
      "Vì thông tin chủ yếu được mã hóa qua sự thay đổi tần số, đồng thời máy thu FM có thể hạn chế nhiều loại nhiễu biên độ.",
      "Vì sóng FM không bị phản xạ hoặc khúc xạ."
    ],
    "answer": 2
  },
  {
    "text": "Một đài phát thanh FM hoạt động tại tần số 95,5 MHz. Tần số này tương đương bao nhiêu kHz?",
    "options": [
      "955 kHz",
      "9550 kHz",
      "95 500 kHz",
      "955 000 kHz"
    ],
    "answer": 2
  },
  {
    "text": "Dải tần phát thanh FM từ 88 MHz đến 108 MHz có độ rộng bao nhiêu?",
    "options": [
      "10 MHz",
      "20 MHz",
      "88 MHz",
      "108 MHz"
    ],
    "answer": 1
  },
  {
    "text": "Một dải tần có độ rộng 12 MHz được chia thành các kênh có khoảng cách tần số 200 kHz. Theo cách tính số khoảng chia, dải tần có bao nhiêu kênh?",
    "options": [
      "40 kênh",
      "50 kênh",
      "60 kênh",
      "80 kênh"
    ],
    "answer": 2
  },
  {
    "text": "Một sóng mang có tần số 750 kHz được điều chế AM bởi tín hiệu âm tần có tần số 3 kHz. Tần số nào sau đây KHÔNG thuộc hai dải biên do thành phần âm tần này tạo ra?",
    "options": [
      "753 kHz",
      "747 kHz",
      "750 kHz",
      "Cả A và B đều thuộc hai dải biên."
    ],
    "answer": 2
  },
  {
    "text": "Trong hệ thống AM thông thường, phổ tần số của tín hiệu điều chế gồm những thành phần cơ bản nào khi tín hiệu âm tần chỉ có một tần số?",
    "options": [
      "Chỉ có tần số sóng mang.",
      "Chỉ có tần số âm tần.",
      "Tần số sóng mang và hai tần số biên.",
      "Hai tần số âm tần và không có sóng mang."
    ],
    "answer": 2
  },
  {
    "text": "Một tín hiệu âm tần có tần số lớn nhất là 8 kHz được dùng để điều chế AM. Nếu chỉ truyền một dải biên và loại bỏ sóng mang, băng thông lý tưởng tối thiểu cần thiết là bao nhiêu?",
    "options": [
      "4 kHz",
      "8 kHz",
      "16 kHz",
      "24 kHz"
    ],
    "answer": 1
  },
  {
    "text": "Trong điều chế AM với sóng mang và hai dải biên, nếu tần số âm tần lớn nhất tăng từ 4 kHz lên 7 kHz thì băng thông cần thiết thay đổi như thế nào?",
    "options": [
      "Giảm từ 8 kHz xuống 7 kHz.",
      "Tăng từ 8 kHz lên 14 kHz.",
      "Giữ nguyên ở 8 kHz.",
      "Tăng từ 4 kHz lên 7 kHz."
    ],
    "answer": 1
  },
  {
    "text": "Một máy thu vô tuyến cần tách tín hiệu âm tần từ sóng AM nhận được. Quá trình này được gọi là gì?",
    "options": [
      "Khuếch đại công suất.",
      "Biến điệu.",
      "Giải điều chế.",
      "Phát xạ điện từ."
    ],
    "answer": 2
  },
  {
    "text": "Một sóng mang có tần số 120 MHz được điều chế bởi tín hiệu có tần số lớn nhất 15 kHz. Nếu sử dụng điều chế AM thông thường, băng thông cần thiết và hai tần số biên ứng với thành phần âm tần 15 kHz lần lượt là bao nhiêu?",
    "options": [
      "15 kHz; 120,015 MHz và 119,985 MHz.",
      "30 kHz; 120,015 MHz và 119,985 MHz.",
      "30 MHz; 135 MHz và 105 MHz.",
      "15 kHz; 120,030 MHz và 119,970 MHz."
    ],
    "answer": 1
  }
];

class SurvivalGame{
  constructor(random=Math.random){
    this.random=random;
    this.reset();
  }

  reset(){
    this.state={
      phase:'idle',
      players:Array.from({length:4},(_,id)=>({
        id,
        hp:3,
        items:[],
        cuffed:false
      })),
      current:0,
      ammo:[],
      capacity:6,
      round:0,
      questionIndex:-1,
      questionCount:0,
      selected:null,
      correct:null,
      target:null,
      saw:false,
      peek:null,
      shot:null,
      pendingShot:null,
      winner:null,
      returnPhase:null,
      events:[],
      eventId:0
    };
  }

  log(text,tone=''){
    const s=this.state;
    s.events.unshift({id:++s.eventId,text,tone});
    s.events.length=Math.min(s.events.length,60);
  }

  randInt(min,max){
    return min+Math.floor(this.random()*(max-min+1));
  }

  randomItem(){
    return Object.keys(ITEMS)[this.randInt(0,4)];
  }

  shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j=this.randInt(0,i);
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  load(){
    const s=this.state;
    const live=this.randInt(2,4);
    const blank=6-live;

    s.ammo=this.shuffle([
      ...Array(live).fill(true),
      ...Array(blank).fill(false)
    ]);
    s.capacity=s.ammo.length;
    s.round++;
    s.peek=null;

    this.log(`Nạp băng ${s.round}: ${live} đạn thật · ${blank} đạn lép.`);
  }

  start(){
    this.reset();
    const s=this.state;

    for(const p of s.players){
      p.items=[this.randomItem(),this.randomItem()];
    }

    this.log('Bắt đầu ván mới. Mỗi tổ nhận 2 vật phẩm.');
    this.load();
    s.phase='reload';
    s.returnPhase='question';
  }

  question(){
    return QUESTIONS[this.state.questionIndex];
  }

  newQuestion(){
    const s=this.state;
    s.questionIndex=(s.questionIndex+1)%QUESTIONS.length;
    s.questionCount++;
    s.selected=null;
    s.correct=null;
    s.target=null;
    s.shot=null;
    s.phase='question';

    this.log(`Lượt Tổ ${s.current+1} · Câu hỏi ${s.questionCount}.`);
  }

  answer(choice){
    const s=this.state;

    if(
      s.phase!=='question'||
      !Number.isInteger(choice)||
      choice<0||
      choice>3
    ){
      return false;
    }

    s.selected=choice;
    s.correct=choice===this.question().answer;
    s.phase='verdict';

    this.log(
      `Tổ ${s.current+1} chọn ${'ABCD'[choice]}: ${s.correct?'chính xác':'chưa đúng'}.`,
      s.correct?'good':'danger'
    );

    if(s.correct){
      const p=s.players[s.current];

      if(p.items.length<4){
        const id=this.randomItem();
        p.items.push(id);
        this.log(`Tổ ${p.id+1} nhận ${ITEMS[id].name}.`,'good');
      }else{
        this.log(`Kho Tổ ${p.id+1} đã đầy (4/4), không nhận thêm vật phẩm.`);
      }
    }

    return true;
  }

  finishAnswer(){
    const s=this.state;
    if(s.phase!=='verdict')return false;

    if(s.correct){
      s.phase='target';
    }else{
      return this.beginAiming(s.current,true);
    }

    return true;
  }

  chooseTarget(target){
    const s=this.state;

    if(
      s.phase!=='target'||
      !Number.isInteger(target)||
      !s.players[target]||
      s.players[target].hp<=0
    ){
      return false;
    }

    s.target=target;
    return true;
  }

  fire(){
    const s=this.state;

    if(
      s.phase!=='target'||
      s.target===null||
      !s.players[s.target]||
      s.players[s.target].hp<=0||
      s.ammo.length===0
    ){
      return false;
    }

    return this.beginAiming(s.target,false);
  }

  beginAiming(target,forced){
    const s=this.state;

    if(
      !(
        (s.phase==='target'&&!forced)||
        (s.phase==='verdict'&&forced&&!s.correct)
      )
    ){
      return false;
    }

    if(
      !Number.isInteger(target)||
      !s.players[target]||
      s.players[target].hp<=0||
      s.ammo.length===0
    ){
      return false;
    }

    s.pendingShot={target,forced};
    s.target=target;
    s.phase='aiming';

    this.log(
      `Tổ ${s.current+1} đang bóp cò ${target===s.current?'tự bắn mình':`nhắm vào Tổ ${target+1}`}…`
    );

    return true;
  }

  finishAiming(){
    const s=this.state;
    if(s.phase!=='aiming'||!s.pendingShot)return false;

    const {target,forced}=s.pendingShot;
    s.pendingShot=null;
    this.resolveShot(target,forced);

    return true;
  }

  resolveShot(target,forced){
    const s=this.state;
    const actor=s.current;
    const live=s.ammo.shift();
    const self=target===actor;
    const damage=live?(forced?1:(s.saw?2:1)):0;

    s.players[target].hp=Math.max(0,s.players[target].hp-damage);

    s.shot={
      actor,
      target,
      live,
      self,
      damage,
      forced,
      keep:!forced&&self&&!live
    };

    s.saw=false;
    s.peek=null;
    s.target=null;
    s.phase='shot';

    this.log(
      `Tổ ${actor+1} ${self?'tự bắn':`bắn Tổ ${target+1}`} → ${live?`đạn thật, −${damage} HP`:'đạn lép, không mất HP'}.`,
      live?'danger':''
    );

    if(s.players[target].hp===0){
      this.log(`Tổ ${target+1} đã bị loại.`,'danger');
    }
  }

  nextPlayer(){
    const s=this.state;

    // Hai vòng là đủ: còng được gỡ ngay khi bỏ qua đúng một lượt.
    for(let step=1;step<=8;step++){
      const id=(s.current+step)%4;
      const p=s.players[id];

      if(p.hp<=0)continue;

      if(p.cuffed){
        p.cuffed=false;
        this.log(`Tổ ${id+1} bị còng tay: bỏ qua lượt, đã gỡ còng.`);
        continue;
      }

      s.current=id;
      return;
    }

    throw new Error('Không tìm thấy tổ còn lượt hợp lệ.');
  }

  finishShot(){
    const s=this.state;
    if(s.phase!=='shot')return false;

    const alive=s.players.filter(p=>p.hp>0);

    if(alive.length===1){
      s.winner=alive[0].id;
      s.phase='won';
      this.log(`Tổ ${s.winner+1} chiến thắng!`,'good');
      return true;
    }

    if(s.shot.keep){
      this.log(`Tổ ${s.current+1} tự bắn đạn lép: giữ lượt!`,'good');
    }else{
      this.nextPlayer();
    }

    if(s.ammo.length===0){
      this.load();
      s.phase='reload';
      s.returnPhase='question';
    }else{
      this.newQuestion();
    }

    return true;
  }

  finishReload(){
    const s=this.state;
    if(s.phase!=='reload')return false;

    const next=s.returnPhase;
    s.returnPhase=null;

    if(next==='question'){
      this.newQuestion();
    }else{
      s.phase='target';
    }

    return true;
  }

  nextOpponent(){
    const s=this.state;

    for(let step=1;step<4;step++){
      const id=(s.current+step)%4;
      if(s.players[id].hp>0)return id;
    }

    return null;
  }

  itemReason(index){
    const s=this.state;
    const p=s.players[s.current];
    const id=p.items[index];

    if(!id)return 'Ô vật phẩm trống.';

    if(s.phase!=='target'){
      return 'Chỉ sử dụng sau khi trả lời đúng, trước khi bắn.';
    }

    if(id==='cigarette'&&p.hp===3){
      return 'HP đã đầy (3/3).';
    }

    if(id==='saw'&&s.saw){
      return 'Cưa tay đã được kích hoạt cho phát bắn này.';
    }

    if(id==='glass'&&s.peek!==null){
      return 'Đã biết viên đạn hiện tại.';
    }

    if((id==='glass'||id==='beer')&&s.ammo.length===0){
      return 'Đang chờ nạp đạn.';
    }

    if(id==='cuffs'){
      const next=this.nextOpponent();

      if(next===null)return 'Không còn đối thủ.';

      if(s.players[next].cuffed){
        return `Tổ ${next+1} đã bị còng, không thể cộng dồn.`;
      }
    }

    return '';
  }

  useItem(index){
    const s=this.state;
    const p=s.players[s.current];

    if(
      !Number.isInteger(index)||
      index<0||
      index>=p.items.length||
      this.itemReason(index)
    ){
      return false;
    }

    const id=p.items.splice(index,1)[0];

    if(id==='cigarette'){
      p.hp=Math.min(3,p.hp+1);
      this.log(`Tổ ${p.id+1} dùng Thuốc lá: hồi 1 HP (${p.hp}/3).`,'good');
    }

    if(id==='saw'){
      s.saw=true;
      this.log(`Tổ ${p.id+1} dùng Cưa tay: phát kế tiếp gây 2 HP nếu đạn thật.`);
    }

    if(id==='glass'){
      s.peek=s.ammo[0];
      this.log(
        `Kính lúp: viên hiện tại là ${s.peek?'ĐẠN THẬT':'ĐẠN LÉP'}.`,
        s.peek?'danger':'good'
      );
    }

    if(id==='beer'){
      const live=s.ammo.shift();
      s.peek=null;
      s.phase='eject';
      this.log(`Tổ ${p.id+1} dùng Chai bia, bỏ 1 ${live?'đạn thật':'đạn lép'}.`);
    }

    if(id==='cuffs'){
      const next=this.nextOpponent();
      s.players[next].cuffed=true;
      this.log(`Tổ ${p.id+1} còng Tổ ${next+1}: bỏ qua lượt kế tiếp.`);
    }

    s.phase=id==='beer'?'eject':'item';
    return true;
  }

  finishItem(){
    if(this.state.phase!=='item')return false;
    this.state.phase='target';
    return true;
  }

  finishEject(){
    const s=this.state;
    if(s.phase!=='eject')return false;

    if(s.ammo.length===0){
      this.load();
      s.phase='reload';
      s.returnPhase='target';
    }else{
      s.phase='target';
    }

    return true;
  }
}
// ENGINE END

export { ITEMS, QUESTIONS, SurvivalGame };
