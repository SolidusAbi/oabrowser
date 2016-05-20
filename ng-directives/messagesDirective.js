angular.module('atlasDemo').directive( 'messages', function () {
    return {
        restrict: 'EA',
        templateUrl: 'ng-templates/messages.html',
        scope: {},
        controller: ['$scope', '$element', 'mainApp', 'firebaseView', function ( $scope, $element, mainApp, firebaseView ) {

            $scope.messages = {};
            $scope.noMessage = true;
            $scope.firebaseView = firebaseView;

            $scope.safeApply = function(fn) {
                //if scope has been destroyed, ie if modal has been dismissed, $root is null
                if (this.$root) {
                    var phase = this.$root.$$phase;
                    if(phase === '$apply' || phase === '$digest') {
                        if(fn && (typeof(fn) === 'function')) {
                            fn();
                        }
                    } else {
                        this.$apply(fn);
                    }
                }
            };

            $scope.emptyForm = function () {
                $scope.newMessage = {};
            };

            $scope.send = function () {
                //retrieve user uid from name
                var uid,
                    recipientUid;

                for (uid in $scope.userNames) {
                    if ($scope.userNames[uid].name === $scope.newMessage.recipient) {
                        recipientUid = uid;
                        break;
                    }
                }
                firebaseView.sendMessage(recipientUid, $scope.newMessage.subject, $scope.newMessage.text);
            };

            function initMessages (messages) {
                $scope.messages = messages.val();
                $scope.noMessage = Object.keys(messages).length === 0;
                var messageId;
                for (messageId in $scope.messages) {
                        $scope.messages[messageId].text = parseTextMessage($scope.messages[messageId].text);
                }
                $scope.safeApply();
            }

            mainApp.on('firebaseView.messages', initMessages);

            $scope.deleteMessage = function (key) {

                $scope.messages[key] = undefined;
                delete $scope.messages[key];
                $scope.noMessage = Object.keys($scope.messages).length === 0;
                $scope.safeApply();

                firebaseView.deleteMessage(key);
            };

            function initUserNames (userNames) {
                $scope.userNames = userNames.val();
                $scope.userNamesList = [];
                var uid;
                for (uid in $scope.userNames) {
                    if ($scope.userNames[uid].name && $scope.userNames[uid].name.length > 0) {
                        $scope.userNamesList.push($scope.userNames[uid].name);
                    }
                }
                $scope.safeApply();
            }
            mainApp.on('firebaseView.userNames', initUserNames);

            $scope.openNewMessageForm = function () {
                $('#newMessageModal').modal('show');
            };

            $scope.openMessagesList = function () {
                $('#messagesListModal').modal('show');
            };

            function createBookmarkMessage (key) {
                $scope.newMessage = $scope.newMessage || {};
                $scope.newMessage.recipient = undefined;
                delete $scope.newMessage.recipient;
                $scope.newMessage.subject = "Check out this view";
                $scope.newMessage.text = 'Click [here]("bookmark://'+key+'") to load the bookmark.';
                $scope.safeApply();
                $scope.openNewMessageForm();
            }
            mainApp.on('bookmarks.shareBookmark', createBookmarkMessage);


            function parseTextMessage (s) {
                //a link to a bookmark has a structure inspired from markdown : [text of the link]("bookmark://bookmarkuid")
                var regexp = /\[(.*?)\]\("bookmark:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"\)/g;
                //escape the html chars
                s = s.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                //replace the link pattern with a javascript link to load the bookmark
                s = s.replace(regexp, (m, p1, p2) =>'<a ng-click="firebaseView.loadBookmark(\''+p2+'\')">'+p1+'</a>');
                return s;
            }

            $scope.isMessageEnabled = function () {
                return firebaseView.auth && firebaseView.auth.provider !== 'anonymous';
            };

        }]
    };
});
