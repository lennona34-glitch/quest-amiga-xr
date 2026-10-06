let TPP=2;
let HBLANK_MIN=0x12*TPP;
let HPIXELS=912*TPP;
let VPIXELS=313;
let xOff = HBLANK_MIN;//252
let yOff=26 + 6;
let clipped_width=HPIXELS-xOff-8*TPP;
let clipped_height=VPIXELS-yOff ;

let ctx=null;

function create2d_context()
{
    const canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    image_data=ctx.createImageData(HPIXELS,VPIXELS);
//    pixel_buffer=new Uint8Array(0);
}

function render_canvas()
{
    let pixels = Module._wasm_pixel_buffer() + yOff*(HPIXELS<<2);
    let pixel_buffer=new Uint8Array(Module.HEAPU8.buffer, pixels, HPIXELS*clipped_height<<2);
    image_data.data.set(pixel_buffer);

    //putImageData(imageData, dx, dy, dirtyX, dirtyY, dirtyWidth, dirtyHeight)
    ctx.putImageData(image_data,
        -xOff/*TPP*/,/*-yOff*/0, 
        /*x,y*/ 
        xOff/*TPP*/,/*yOff*/0 
        /* width, height */, 
        clipped_width, clipped_height); 
}

function js_set_display(_xOff, _yOff, _clipped_width,_clipped_height) {
    xOff=_xOff*TPP -HBLANK_MIN*4;
    yOff=_yOff;
    clipped_width =_clipped_width;
    clipped_height=_clipped_height;
    if(clipped_height%2!=0) clipped_height++; //when odd make the height even 
    if(clipped_height+yOff > VPIXELS)
    {
        clipped_height=(VPIXELS-yOff) & 0xfffe;
    }

    let the_canvas = document.getElementById("canvas");
    the_canvas.width=clipped_width;
    if(typeof gl != 'undefined' && gl!=null)
    {
        the_canvas.height=clipped_height*2;

        let VPOS_CNT=VPIXELS;
        let HPOS_CNT=HPIXELS;
        updateTextureRect(xOff /HPOS_CNT, yOff / VPOS_CNT, (xOff+clipped_width) / HPOS_CNT, (yOff+clipped_height)/VPOS_CNT); 
    }
    else
    {
        the_canvas.height=clipped_height;
    }
}

function scaleVMCanvas() {
    let the_canvas = document.getElementById("canvas");

    //reserve space for the docked live memory view (if open)
    var reserved = (typeof memview_reserved_width === 'function') ? memview_reserved_width() : 0;
    var avail_width  = window.innerWidth - reserved;
    var avail_height = window.innerHeight;
    var wratio = avail_width / avail_height;

    // Authentic 4:3 Commodore CRT aspect ratio strictly enforced unless widescreen mode requested
    var src_ratio = use_wide_screen ? wratio : (4 / 3);
    var inv_src_ratio = 1 / src_ratio;

    //shrink the horizontal centering box (left:0 .. right:reserved) so the
    //canvas (margin:auto) centers within the available left area instead of
    //the full viewport and is not covered by the memory view panel
    $("#canvas").css("right", reserved + 'px');

    var topPos=0;
    if(wratio < src_ratio)
    {
        var reducedHeight=avail_width*inv_src_ratio;
        //all lower than 1.25
        $("#canvas").css("width", avail_width+'px')
        .css("height", Math.round(reducedHeight)+'px');
        
        const isKbActive = $("#virtual_keyboard").hasClass('show') && ($("#virtual_keyboard").innerHeight() > 0);
        if (!isKbActive) {
            topPos = Math.max(0, Math.round((avail_height - reducedHeight) / 2));
        } else {
            var keyb_height = $("#virtual_keyboard").innerHeight() || 0;
            topPos = Math.max(0, Math.round(avail_height - reducedHeight - keyb_height));
        }
    }
    else
    {
        //all greater than 1.25
        var target_width;
        if(use_wide_screen)
        {
            target_width = avail_width;
        }
        else
        {
            target_width = Math.round(avail_height*src_ratio);
            if(target_width > avail_width) target_width = avail_width;
        }
        $("#canvas").css("width", target_width +'px');
        $("#canvas").css("height", "100%"); 
    }

    $("#canvas").css("top", topPos + 'px');   
};
