<?xml version="1.0" encoding="UTF-8"?>
<sld:StyledLayerDescriptor xmlns="http://www.opengis.net/sld" xmlns:sld="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml" version="1.0.0">
    <sld:UserLayer>
        <sld:LayerFeatureConstraints>
            <sld:FeatureTypeConstraint/>
        </sld:LayerFeatureConstraints>
        <sld:UserStyle>
            <sld:Name>heatmap_randompts_test</sld:Name>
            <sld:FeatureTypeStyle>
                <sld:Name>name</sld:Name>
                <sld:Rule>
                    <sld:RasterSymbolizer>
                        <sld:ColorMap>
                            <sld:ColorMapEntry color="#FFFFFF" opacity="0.0" quantity="0" label="-no data-"/>
                            <sld:ColorMapEntry color="#053061" opacity="0.0" quantity="159"/>
                            <sld:ColorMapEntry color="#2166AC" opacity="1.0" quantity="169"/>
                            <sld:ColorMapEntry color="#4393C3" opacity="1.0" quantity="179"/>
                            <sld:ColorMapEntry color="#92C5DE" opacity="1.0" quantity="189"/>
                            <sld:ColorMapEntry color="#D1E5F0" opacity="1.0" quantity="199"/>
                            <sld:ColorMapEntry color="#FDDBC7" opacity="1.0" quantity="209"/>
                            <sld:ColorMapEntry color="#F4A582" opacity="1.0" quantity="219"/>
                            <sld:ColorMapEntry color="#D6604D" opacity="1.0" quantity="229"/>
                            <sld:ColorMapEntry color="#B2182B" opacity="1.0" quantity="239"/>
                        </sld:ColorMap>
                    </sld:RasterSymbolizer>
                </sld:Rule>
            </sld:FeatureTypeStyle>
        </sld:UserStyle>
    </sld:UserLayer>
</sld:StyledLayerDescriptor>

