// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'

var app = angular.module('parkthat', ['ionic','ngCordova','timer']);

var serviceUrl = "http://parkthat.fourmi.com.my:8080/parkthat/services/";

var db;

app.run(function($ionicPlatform, $rootScope, $cordovaSQLite) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if(window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if(window.StatusBar) {
      StatusBar.styleDefault();
    }
    if (window.cordova) {
      db = $cordovaSQLite.openDB({ name: "parkthat.db" }); //device
    }else{
      db = window.openDatabase("parkthat.db", '1', 'parkthat', 1024 * 1024 * 100); // browser
    }
    db.transaction(function(tx) {
        tx.executeSql('DROP TABLE IF EXISTS preferences');
        tx.executeSql('CREATE TABLE IF NOT EXISTS preferences (key  varchar(255) primary key, value text)');
    }, function(e) {
      console.log("ERROR: " + e.message);
    });
  });
});

app.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
  .state('park', {
    abstract: true,
    url: '/park',
    template: '<ion-nav-view></ion-nav-view>',
    controller : 'ParkCtrl'
  })
  .state('park.new', {
    url: '/new',
    templateUrl: 'views/park/new.html',
    controller : 'ParkNewCtrl'
  }).state('park.inprogress', {
    url: '/inpogress',
    templateUrl: 'views/park/inprogress.html',
    controller : 'ParkInProgressCtrl'
  });
});

app.controller('IndexCtrl', function($scope, $state) {
    $state.go('park.new');
});


app.controller('ParkCtrl', function($scope, $state) {
    $scope.park = {
        status: "NEW",
        charges: 0.14,
        time: 0,
        addCharge : function() {
            this.charges = this.charges + 0.14;
            this.time += 600;
        },
        plateNo: "WVR2600"
    };
});


app.factory('Preferences', ['$q','$cordovaSQLite', function($q, $cordovaSQLite) {

	return {
      set: function (key, value) {
        var q = $q.defer();
        var insertQuery = "INSERT INTO preferences (key, value) VALUES (?,?)";     
        var updateQuery = "UPDATE preferences SET value = ? where key = ?";
        var jsonString = JSON.stringify(value);
        this.get(key).then(function(res) {
            if(res == null) {
                $cordovaSQLite.execute(db, insertQuery, [key, jsonString]).then(function(res) {
                    q.resolve(res);
                    console.log(res);
                }, function(err){
                    console.log(err);
                    q.resolve(err);
                });
            } else {
                $cordovaSQLite.execute(db, updateQuery, [jsonString, key]).then(function(res) {
                    q.resolve(res);
                    console.log(res);
                }, function(err){
                    console.log(err);
                    q.resolve(err);
                });
            }
            
        });
        return q.promise;
      },
      get: function (key) {
        var q = $q.defer();

        var query = "SELECT * FROM preferences where key = ?";    
        $cordovaSQLite.execute(db, query, [key]).then(function(res) {
           if(res.rows.length > 0 ) {
               q.resolve(JSON.parse(res.rows.item(0)['value']));
           } else {
                q.resolve(null);
           }
        }, function(err){
            q.resolve(null);
        });
        return q.promise;
      }
    };
}]);

app.controller('ParkNewCtrl', function($scope, $state, Preferences, $ionicModal, $http) {
    $scope.createPark = function(park) {
        Preferences.get('client').then(function (client) {
            if(client != null && client.authToken != null && client.authToken.length > 0) {                                    
                Preferences.get('client').then(function (client) {
                    var url = serviceUrl +  "parkmanagement/parkcar/park";
                    var request = {token: client.authToken, phoneNo: client.phoneNo, plateNo: $scope.park.plateNo};
                    $http.post(url, request).success(function(data, status, headers, config) {                
                        $scope.park.status = "IN_PROGRESS";
                        $scope.park.charges = 0.14;
                        $scope.park.parkCarTransactionId = data.id;
                        $state.go('^.inprogress');
                    }).error(function(data, status, headers, config) {
                        console.log("error. data=" + data);
                    });
                });
            } else {
                $scope.newRegistration();
            }
        });
    }
    
    $ionicModal.fromTemplateUrl('views/park/register.html', function(modal) {
        $scope.registrationModal = modal;
    }, {
        scope: $scope
    });
    
    
    $ionicModal.fromTemplateUrl('views/park/activate.html', function(modal) {
        $scope.activationModal = modal;
    }, {
        scope: $scope
    });
    
    $scope.newRegistration = function() {
        Preferences.get('client').then(function (client) {
            if(client != null) {
                $scope.newActivation();
            } else {
                $scope.registerClientRequest = {countryCode: 60, username:"", email:"", phoneNo:""}
                $scope.registrationModal.show();
            }
        });
        
    };
    $scope.register = function() {
        $scope.registerClientRequest.phoneNo = $scope.registerClientRequest.countryCode + $scope.registerClientRequest.phoneNo;
        var url = serviceUrl +  "parkmanagement/client/register";
        var request = $scope.registerClientRequest;
        delete request.countryCode;
        $http.post(url, request).success(function(data, status, headers, config) {
            var client = {username:$scope.registerClientRequest.username, id: data.id, phoneNo: $scope.registerClientRequest.phoneNo, email: $scope.registerClientRequest.email};
            Preferences.set('client', client).then(function(res) {
                console.log(res);
                $scope.newActivation();
                $scope.registrationModal.hide();
            }, function(err) {
                console.log(err);
            });
        }).error(function(data, status, headers, config) {
            console.log("error. data=" + data);
        });
    };
    
    $scope.newActivation = function() {
        Preferences.get('client').then(function(client) {
            console.log(client);
            if(client != null) {
                $scope.activateClientRequest = {phoneNo: client.phoneNo, activationCode:""}
                $scope.activationModal.show();
            } else {
                $scope.newRegistration();
            }
        });
        
    };
    $scope.activate = function() {
        var url = serviceUrl +  "parkmanagement/client/activate";
        var request = $scope.activateClientRequest;
        $http.post(url, request).success(function(data, status, headers, config) {
            Preferences.get('client').then(function(client){
                client.authToken = data.token;
                Preferences.set('client', client);
            });
            $scope.activationModal.hide();
        }).error(function(data, status, headers, config) {
            console.log("error. data=" + data);
        });
    };
});


app.controller('ParkInProgressCtrl', function($scope, $state, $interval, $http, Preferences, $ionicPopup) {
    $scope.startTimer = function (){
        $scope.$broadcast('timer-start');
    };

    $scope.stopTimer = function (){
        $scope.$broadcast('timer-stop');
    };
    $interval(function(){
        $scope.park.addCharge();
    }, 600000);

    $scope.completePark = function() {
        Preferences.get('client').then(function (client) {
            var url = serviceUrl +  "parkmanagement/parkcar/unpark";
            var request = {token: client.authToken, phoneNo: client.phoneNo, id: $scope.park.parkCarTransactionId};
            $http.post(url, request).success(function(data, status, headers, config) {       
                console.log(data);
                var alertPopup = $ionicPopup.alert({
                   title: 'Summary',
                   template: 'Charges:RM' + data.charges + '(' + Math.round(data.duration / 1000 / 60) + 'minutes). </br> Balance:RM' + data.balance
                });
                alertPopup.then(function(res) {                        
                    $state.go('^.new');
                });
                 
            }).error(function(data, status, headers, config) {
                console.log("error. data=" + data);
            });
        });
    }
});