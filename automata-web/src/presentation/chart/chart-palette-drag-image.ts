// /////////////////////////////////////////////////////////////////////////////////////////////////
//
// Name:    Chart Palette Drag Image
// Version: 1.0.0
// Date:    2026-09-06
// Author:  Rohin Gosling
//
// Description:
//
//   Prepares decoded, transparent glyph bitmaps before native palette dragging begins.
//
// /////////////////////////////////////////////////////////////////////////////////////////////////

interface PreparedPaletteDragImage
{
    readonly signature: string;
    readonly width:     number;
    readonly height:    number;
    image:              HTMLImageElement | null;
    pending:            boolean;
}

const preparedImages = new WeakMap<HTMLImageElement, PreparedPaletteDragImage> ();

//--------------------------------------------------------------------------------------------------
// Function: prepareChartPaletteDragImage
//
// Description:
//
//   Bakes the rendered glyph color into a decoded PNG. Transparent pixels stay transparent and the
//   image has matching intrinsic dimensions and hotspot units, independent of SVG/CSS capture.
//
//--------------------------------------------------------------------------------------------------

export async function prepareChartPaletteDragImage ( icon: HTMLImageElement ): Promise<void>
{
    const style     = window.getComputedStyle ( icon );
    const width     = Math.max ( 1, Math.round ( icon.clientWidth || icon.naturalWidth || 16 ) );
    const height    = Math.max ( 1, Math.round ( icon.clientHeight || icon.naturalHeight || 16 ) );
    const signature = JSON.stringify ( [ icon.currentSrc || icon.src, style.color, width, height ] );
    const existing  = preparedImages.get ( icon );

    if ( existing?.signature === signature && ( existing.pending || existing.image !== null ) )
    {
        return;
    }

    const prepared: PreparedPaletteDragImage = { height, image: null, pending: true, signature, width };

    preparedImages.set ( icon, prepared );

    try
    {
        if ( typeof icon.decode === "function" )
        {
            await icon.decode ();
        }

        if ( !icon.complete || icon.naturalWidth === 0 || icon.naturalHeight === 0 )
        {
            return;
        }

        const canvas = document.createElement ( "canvas" );

        canvas.width  = width;
        canvas.height = height;

        const context = canvas.getContext ( "2d" );

        if ( context === null )
        {
            return;
        }

        context.drawImage ( icon, 0, 0, width, height );
        context.globalCompositeOperation = "source-in";
        context.fillStyle = style.color || "#000000";
        context.fillRect ( 0, 0, width, height );

        const image = new Image ( width, height );

        image.src = canvas.toDataURL ( "image/png" );

        if ( typeof image.decode === "function" )
        {
            await image.decode ();
        }
        else if ( !image.complete )
        {
            await new Promise<void> ( ( resolve, reject ) =>
            {
                image.onload  = () => resolve ();
                image.onerror = () => reject ( new Error ( "The palette drag image could not be decoded." ) );
            } );
        }

        if ( image.naturalWidth > 0 && preparedImages.get ( icon ) === prepared )
        {
            prepared.image = image;
        }
    }
    catch
    {
        // Keep ordinary native dragging available if image decoding or canvas encoding fails.
    }
    finally
    {
        prepared.pending = false;
    }
}

//--------------------------------------------------------------------------------------------------
// Function: prepareChartPaletteDragImages
//
// Description:
//
//   Keeps palette bitmaps ready across icon loads, theme changes, forced colors, and display
//   changes.
//   Cleanup invalidates in-flight preparations without affecting the palette or document contents.
//
//--------------------------------------------------------------------------------------------------

export function prepareChartPaletteDragImages ( palette: HTMLElement ): () => void
{
    const icons = new Set<HTMLImageElement> ();
    const shell = palette.closest ( ".application-shell" );
    let active  = true;

    const prepareImages = (): void =>
    {
        if ( !active )
        {
            return;
        }

        palette.querySelectorAll<HTMLImageElement> ( "img" ).forEach ( icon =>
        {
            icons.add ( icon );
            void prepareChartPaletteDragImage ( icon );
        } );
    };
    const observer = new MutationObserver ( prepareImages );

    observer.observe ( palette, { attributeFilter: [ "src", "class", "style" ], attributes: true,
        childList: true, subtree: true } );

    if ( shell !== null )
    {
        observer.observe ( shell, { attributeFilter: [ "data-theme", "class", "style" ], attributes: true } );
    }

    const forcedColors = typeof window.matchMedia === "function"
        ? window.matchMedia ( "(forced-colors: active)" ) : null;

    forcedColors?.addEventListener ( "change", prepareImages );
    palette.addEventListener ( "load", prepareImages, true );
    palette.addEventListener ( "pointerdown", prepareImages );
    window.addEventListener ( "resize", prepareImages );
    prepareImages ();

    return () =>
    {
        active = false;
        observer.disconnect ();
        forcedColors?.removeEventListener ( "change", prepareImages );
        palette.removeEventListener ( "load", prepareImages, true );
        palette.removeEventListener ( "pointerdown", prepareImages );
        window.removeEventListener ( "resize", prepareImages );
        icons.forEach ( icon => preparedImages.delete ( icon ) );
    };
}

//--------------------------------------------------------------------------------------------------
// Function: setChartPaletteDragImage
//
// Description:
//
//   Selects a prepared glyph synchronously during dragstart. The already loaded source icon remains
//   a fallback; this helper never changes the drag payload, allowed operation, or source element.
//
//--------------------------------------------------------------------------------------------------

export function setChartPaletteDragImage (
    dataTransfer: Pick<DataTransfer, "setDragImage">,
    icon: HTMLImageElement,
): void
{
    if ( typeof dataTransfer.setDragImage !== "function" )
    {
        return;
    }

    const prepared = preparedImages.get ( icon );

    if ( prepared?.image !== null && prepared?.image !== undefined )
    {
        try
        {
            dataTransfer.setDragImage ( prepared.image, prepared.width / 2, prepared.height / 2 );
            return;
        }
        catch
        {
            // Some native implementations may reject a prepared image; retain the loaded SVG
            // fallback.
        }
    }

    if ( icon.complete && icon.naturalWidth > 0 && icon.naturalHeight > 0 )
    {
        dataTransfer.setDragImage ( icon,
            Math.max ( 1, ( icon.clientWidth || icon.naturalWidth ) / 2 ),
            Math.max ( 1, ( icon.clientHeight || icon.naturalHeight ) / 2 ) );
    }
}
