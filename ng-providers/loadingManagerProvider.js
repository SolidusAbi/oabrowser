angular.module('atlasDemo').provider('loadingManager', ['mainAppProvider', 'volumesManagerProvider', 'atlasJsonProvider', function (mainAppProvider, volumesManagerProvider, atlasJsonProvider) {

    var mainApp = mainAppProvider.$get(),
        atlasJson = atlasJsonProvider.$get(),
        volumesManager = volumesManagerProvider.$get(),
        nrrdLoader = new THREE.NRRDLoader(),
        vtkLoader = new THREE.VTKLoader(),
        singleton = {
            numbersOfModelsLoaded : 0,
            numbersOfVolumesLoaded : 0
        },
        volumesLoaded = {},
        volumesProgress = {},
        modelsLoaded = {};

    function loadVolume(datasource, treatAsBackground) {

        var nrrdFileLocation = datasource.source;

        var onProgress = function ( xhr ) {
            if ( xhr.lengthComputable ) {
                var percentComplete = Math.round(xhr.loaded / xhr.total * 100);
                volumesProgress[nrrdFileLocation] = percentComplete;
                mainApp.emit('loadingManager.volumeProgress', {filename : nrrdFileLocation, progress : percentComplete});
            }
        };

        var onSuccess = function (volume) {
            volumesLoaded[nrrdFileLocation] = true;
            singleton.numberOfVolumesLoaded++;

            volumesManager.addVolume(volume, datasource, treatAsBackground);

            mainApp.emit('loadingManager.volumeLoaded', nrrdFileLocation);
            if (singleton.totalNumberOfVolumes === singleton.numberOfVolumesLoaded) {
                mainApp.emit('loadingManager.everyVolumeLoaded');
                testIfLoadingIsFinished();
            }
        };

        mainApp.emit('loadingManager.volumeStart', nrrdFileLocation);

        nrrdLoader.load( nrrdFileLocation, onSuccess, onProgress );

    }

    function loadModel(structure) {
        var file;
        if (Array.isArray(structure.sourceSelector)) {
            var geometrySelector = structure.sourceSelector.find(selector => selector['@type'].includes('geometrySelector'));
            if (geometrySelector) {
                file = geometrySelector.dataSource.source;
            }
            else {
                throw 'In case of multiple selectors, VTK selector should have an array as @type which includes "geometrySelector"';
            }
        }
        else {
            file = structure.sourceSelector.dataSource.source;
        }

        vtkLoader.load(file, function (geometry) {

            var item = structure;

            geometry.computeVertexNormals();

            var material = new THREE.MeshPhongMaterial({
                wireframe : false,
                morphTargets : false,
                side : THREE.DoubleSide,
                color : item.renderOptions.color >> 8 //get rid of alpha
            });

            material.opacity = (item.renderOptions.color & 0xff)/255;
            material.visible = true;


            if (material.opacity < 1) {
                material.transparent = true;
            }


            var mesh = new THREE.Mesh(geometry, material);
            mesh.name = item.annotation && item.annotation.name || '';
            mesh.renderOrder = 1;
            item.mesh = mesh;
            mesh.atlasStructure = item;

            modelsLoaded[file] = true;
            singleton.numbersOfModelsLoaded++;

            //signal to the modal
            mainApp.emit('loadingManager.modelLoaded', file);

            mainApp.emit('loadingManager.newMesh', mesh);

            if (singleton.numberOfModelsLoaded === singleton.totalNumberOfModels) {
                mainApp.emit('loadingManager.everyModelLoaded');
                testIfLoadingIsFinished();
            }

        });
    }

    function dealWithAtlasStructure(data) {
        var i,
            atlasStructure = atlasJson.parse(data);

        mainApp.atlasStructure = atlasStructure;

        var header = atlasStructure.header;
        if (header) {
            mainApp.emit('headerData',header);
        }

        //load the models

        var vtkStructures = atlasStructure.structure.filter(item => {
            if (Array.isArray(item.sourceSelector)) {
                return item.sourceSelector.some(selector => /\.vtk$/.test(selector.dataSource.source));
            }
            else {
                return /\.vtk$/.test(item.sourceSelector.dataSource.source);
            }
        });

        singleton.totalNumberOfModels = vtkStructures.length;


        for (i = 0; i<vtkStructures.length; i++) {
            loadModel(vtkStructures[i]);
        }


        //load labelmap and background

        var nrrdDatasource = atlasStructure.datasource.filter(datasource => /\.nrrd$/.test(datasource.source));
        singleton.totalNumberOfVolumes = nrrdDatasource.length;

        for (i = 0; i < nrrdDatasource.length; i++) {
            loadVolume(nrrdDatasource[i]);
        }



        mainApp.emit('loadingManager.atlasStructureLoaded', atlasStructure);

        //add this event in case the json is loaded before angular compilation is finished
        angular.element(document).ready(function () {
            mainApp.emit('loadingManager.atlasStructureLoaded', atlasStructure);
        });

    }

    function loadAtlasStructure (location) {
        jQuery.ajax({
            dataType: "json",
            url: location,
            async: true,
            success: dealWithAtlasStructure
        });
        mainApp.emit('loadingManager.atlasStructureStart');
    }

    function testIfLoadingIsFinished () {
        if (singleton.numberOfModelsLoaded === singleton.totalNumberOfModels && singleton.totalNumberOfVolumes === singleton.numberOfVolumesLoaded) {
                mainApp.emit('loadingManager.loadingEnd');
        }
    }

    function isLoading() {
        return singleton.numberOfModelsLoaded !== singleton.totalNumberOfModels || singleton.totalNumberOfVolumes !== singleton.numberOfVolumesLoaded;
    }

    singleton.loadVolume = loadVolume;
    singleton.loadModel = loadModel;
    singleton.loadAtlasStructure = loadAtlasStructure;
    singleton.volumesLoaded = volumesLoaded;
    singleton.volumesProgress = volumesProgress;
    singleton.modelsLoaded = modelsLoaded;
    singleton.isLoading = isLoading;


    Object.defineProperty(singleton, 'numberOfVolumesLoaded', {
        get : function () {
            return Object.keys(volumesLoaded).length;
        },
        set : function () {}
    });

    //methods accessible from outside by injecting volumesManager
    this.$get = function () {
        return singleton;
    };
}]);