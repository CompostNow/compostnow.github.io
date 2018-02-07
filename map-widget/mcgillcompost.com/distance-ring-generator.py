import math

###
### TODO: limit rings to no more than 1000px in radius
###

template = """
<svg
    xmlns="http://www.w3.org/2000/svg"
    xmlns:svg="http://www.w3.org/2000/svg"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    viewBox='0 0 {diameter} {diameter}'
    version='1.1'
    encoding='utf-8'
    width='{diameter}'
    height='{diameter}'
    xml:space="preserve">
    <style type="text/css">
        circle {{stroke:#00a1ad;stroke-width:1;stroke-opacity:0.5;fill:none}}
        text {{fill:#00a1ad;fill-opacity:0.5;font-family:'Myriad Pro','Myriad',sans-serif}}
    </style>

    <circle cx="{center}" cy="{center}" r="{radius5}" />
    <text x="{center}" y="{radius5topy}" text-anchor="middle">5 miles</text>
    <text x="{center}" y="{radius5boty}" text-anchor="middle">5 miles</text>

    <circle cx="{center}" cy="{center}" r="{radius10}" />
    <text x="{center}" y="{radius10topy}" text-anchor="middle">10 miles</text>
    <text x="{center}" y="{radius10boty}" text-anchor="middle">10 miles</text>

    <circle cx="{center}" cy="{center}" r="{radius20}" />
    <text x="{center}" y="{radius20topy}" text-anchor="middle">20 miles</text>
    <text x="{center}" y="{radius20boty}" text-anchor="middle">20 miles</text>

    <circle cx="{center}" cy="{center}" r="{radius50}" />
    <text x="{center}" y="{radius50topy}" text-anchor="middle">50 miles</text>
    <text x="{center}" y="{radius50boty}" text-anchor="middle">50 miles</text>

    <circle cx="{center}" cy="{center}" r="{radius75}" />
    <text x="{center}" y="{radius75topy}" text-anchor="middle">75 miles</text>
    <text x="{center}" y="{radius75boty}" text-anchor="middle">75 miles</text>
</svg>
"""

centerPoints = {}
for zoom in range(5, 17):

    '''
    At zoom level 0 entire earth fits in one 256px tile
    scale doubles at each step
    the circumference of the earth is 40,075 km

    At zoom level 17, each pixel is 40075*1000/(256*2^17) = 1.19 meters
    '''
    metersPerPixel = 40075*1000/(256*math.pow(2, zoom))
    metersPerMile = 1609.344
    pixelsPerMile = metersPerMile / metersPerPixel

    args = {}
    maxRadius = 0;
    for miles in [5, 10, 20, 50, 75]:

        #if zoom >= 13 and miles > 20:
        #    continue

        maxRadius = miles*pixelsPerMile

        args.update({
            'radius%s' % miles: maxRadius,
            #'radius%stopy' % miles: miles*pixelsPerMile + 20,
            #'radius%sboty' % miles: miles*pixelsPerMile - 10,
        })

    args['center'] = maxRadius
    args['diameter'] = maxRadius * 2

    centerPoints[zoom] = maxRadius

    for miles in [5, 10, 20, 50, 75]:

        #if zoom >= 13 and miles > 20:
        #    continue

        args.update({
            'radius%stopy' % miles: maxRadius - args['radius%s' % miles] + 20,
            'radius%sboty' % miles: maxRadius + args['radius%s' % miles] - 10,
        })

    svg = template.format(**args)

    with open('distance-rings-z%s.svg' % zoom, 'w') as f:
        f.write(svg)

print centerPoints
