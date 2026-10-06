class RingBuffer {
    constructor(capacity) {
        this.capacity = capacity+1;
        this.capacity_usable = capacity;
        this.r = 0;
        this.w = 0;
        this.elements = new ArrayBuffer(this.capacity);
    }
 
    clear(){
        this.r = 0;
        this.w = 0;
        for (let i = 0; i < this.capacity; i++) { this.elements[i] = null; }
    }
 
    align(offset) {
        this.w = (this.r + offset) % this.capacity;
    }
 
    count() {
        return (this.capacity + this.w - this.r) % this.capacity;
    }
    free()  { return this.capacity - this.count() - 1; }
    fillLevel() { return this.count() / this.capacity; }
    isEmpty()  { return this.r == this.w; }
    isFull()  { return this.count() == this.capacity - 1; }
 
    begin()  { return this.r; }
    end()  { return this.w; }
    next(i) { return i < this.capacity - 1 ? i + 1 : 0; }
    prev(i) { return i > 0 ? i - 1 : this.capacity - 1; }
 
    read()
    {
        let oldr = this.r;
        this.r = this.r < this.capacity_usable ? this.r + 1 : 0;
        return this.elements[oldr];
    }
 
    write(element)
    {
        this.elements[this.w] = element;
        this.w = this.w < this.capacity_usable ? this.w + 1 : 0;
    }
  
    skip()
    {
        this.r = this.next(this.r);
    }
   
    skip(n)
    {
        this.r = (this.r + n) % this.capacity;
    }
   
    current(offset)
    {
        return this.elements[(this.r + offset) % this.capacity];
    }
}

class vAmigaAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = this.handleMessage.bind(this);
    this.port.onmessageerror = (error)=>{ 
      console.error("error:"+ error);
    };

    this.fetch_buffer_stack=new RingBuffer(16);
    this.buffer=null;
    this.buf_addr=0;
    this.recyle_buffer_stack=new RingBuffer(16);
    for(let i=0; i<16;i++)
    {
      this.recyle_buffer_stack.write(new Float32Array(2048));
    }  

    this.counter_no_buffer=0;
    console.log("vAmiga_audioprocessor connected");
  }

  handleMessage(event) {
    this.fetch_buffer_stack.write(event.data);
  }

  fetch_data()
  {
    if(!this.recyle_buffer_stack.isEmpty())
    {
      let shuttle=this.recyle_buffer_stack.read();
      this.port.postMessage(shuttle, [shuttle.buffer]);
    }
    else
    {
      this.port.postMessage("empty");
    }
  }

  process(inputs, outputs) {
    if(this.buffer == null)
    {
      if(!this.fetch_buffer_stack.isEmpty())
      {
        this.buffer=this.fetch_buffer_stack.read();
        this.buf_addr=0;
      }
      else if(this.counter_no_buffer%1024==0)
      { 
        this.fetch_data();
      }
      this.counter_no_buffer+=128;
    }
    if(this.buffer!=null)
    {
      const output = outputs[0];

      let startpos=this.buf_addr;
      let endpos=startpos+128;
      output[0].set(this.buffer.subarray(startpos,endpos));
      output[1].set(this.buffer.subarray(1024+startpos,1024+endpos));
      this.buf_addr=endpos;
      
      if(endpos>=1024)
      {
        this.recyle_buffer_stack.write(this.buffer);
        this.buffer=null;
        this.buf_addr=0;

        this.fetch_data();      
      }  
    }
    return true;
  }
}

registerProcessor('vAmiga_audioprocessor', vAmigaAudioProcessor);
