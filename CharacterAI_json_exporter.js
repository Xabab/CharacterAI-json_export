// ==UserScript==
// @name         CharacterAI json exporter
// @namespace    http://tamperchrome-extension://dhdgffkkebhmkfjojejmpbldmpobfkfo/options.html#nav=new-user-script+editormonkey.net/
// @version      0.2
// @description  Export a chat history or a character definition in json format.
// @author       Xabab
// @run-at       document-idle
// @match        https://beta.character.ai/chat?char=*
// @match        https://beta.character.ai/editing?char=*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=character.ai
// @grant        none
// @license      X11

// @require      https://unpkg.com/turndown/dist/turndown.js
// @require      https://unpkg.com/file-saver/dist/FileSaver.js

// ==/UserScript==

"Export a chat history or a character definition in json format.";
"Script is intended and alowed only for personal entertainment use";
"on behalf of Characters and Generations usage rights (https://beta.character.ai/tos#:~:text=Characters%20and%20Generations).";
"Any usage for data mining, robots, scraping or similar automated data gathering will violate CharacterAI's Terms of Service";
"(https://beta.character.ai/tos#:~:text=Website%20or%20Services%20Content%2C%20Software%20and%20Trademarks) and thus is prohibited";

'use strict';

var pageProcessed = false;

// tampermonkey has a strange @run-at implementation (i.e. it does not fucking work), doing it by hand
// observer singleton
var Observer = (function () {
    var instance;
    var observing = false;

    function createInstance() {
        console.log("createInstance");
        var object = new MutationObserver(check);
        return object;
    }

    return {
        getInstance: function () {
            //console.log("getInstance");
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        },

        observe: function(document, dict) {
            //console.log("observe");
            instance = Observer.getInstance()
            if(observing) {
                //console.log("already observing, return");
                return;
            }
            //console.log("observing...");
            observing = true;
            instance.observe(document, dict)
        },
        disconnect: function() {
            //console.log("disconnect...")
            instance = Observer.getInstance()
            instance.disconnect();
        }
    };

    function check(changes, observer) {
        //console.log("check");
        // if the element we want to change is found, stop obsever
        if(document.querySelector('.px-3')) { //settings, character strip
            observer.disconnect();
            pageProcessed = true;
            observing = false;
            console.log("Xabab: Seems like this is the character settings page, stopping observer...")
            settingsTab()
        }
        if(document.querySelector('.chatfooter')) { //chat, chatbox
            observer.disconnect();
            pageProcessed = true;
            observing = false;
            console.log("Xabab: Seems like this is the chat page, stopping observer...")
            chatTab()
        }
    };
})();

// make script to work with AJAX changes. yoinked from:
//https://stackoverflow.com/questions/17862394/my-userscript-only-works-when-the-page-is-refreshed-or-on-iframes-not-the-main/17872564#17872564
var pageURLCheckTimer = setInterval (
    function () {
        if (    this.lastPathStr  !== location.pathname
            ||  this.lastQueryStr !== location.search
            ||  this.lastPathStr   === null
            ||  this.lastQueryStr  === null
           ) {
            this.lastPathStr  = location.pathname;
            this.lastQueryStr = location.search;
            gmMain ();
        }
    }
    , 222);

function gmMain () {
    if (window.self === window.top && !pageProcessed){
        //console.log("gmMain");

        (function() {
            // checking for document change
            Observer.observe(document, {childList: true, subtree: true});
        })();
    }
    downloadedOnce = false;
    setTimeout(() => {pageProcessed = false}, 10);
}


function settingsTab(){
    //first, copy the button to not define its style by hand

    // get character info strip (link back to character)
    var characterStrip = document.getElementsByClassName("px-3");
    characterStrip = characterStrip[0];

    var characterDiv = characterStrip.firstChild;

    // dublicate the strip
    const downloadDiv = characterDiv.cloneNode(true);
    downloadDiv.id = "download";

    // remove the link
    var a = downloadDiv.querySelector('a');
    a.removeAttribute("href");

    // find element with content
    var downloadDivContent = downloadDiv.querySelectorAll(".justify-content-left");
    downloadDivContent = downloadDivContent[downloadDivContent.length - 1];

    // remove all content
    while (downloadDivContent.firstChild) {
        downloadDivContent.removeChild(downloadDivContent.lastChild);
    };


    // then add my content

    // add material icons by google
    const materialIconsLink = Object.assign(document.createElement('link'), {
        href: 'https://fonts.googleapis.com/icon?family=Material+Icons',
        rel: 'stylesheet'
    });
    document.head.appendChild(materialIconsLink);

    // then add container, icon and label of the button
    var innerA = Object.assign(document.createElement('a'), {
        style    : "display: flex;",
        role     : "button",
        onclick  : downloadCharacterJson
    });

    var icon = Object.assign(document.createElement('span'), {
        className: "material-icons",
        innerHTML: 'download',
    });
    innerA.appendChild(icon);

    var downloadText = Object.assign(document.createElement('span'), {
        className: "p-0",
        innerHTML: 'DOWNLOAD JSON DEFINITION'
    });
    innerA.appendChild(downloadText);

    downloadDivContent.appendChild(innerA);

    // add download button to page
    characterDiv.insertAdjacentElement('afterend', downloadDiv);
    // move download button under character link strip
    characterStrip.style = "display: block;";
}

function chatTab(){
    // for whatever reason chatbox footer appears, disappears and then appears again nullifying my attempt to change it,
    // so here's my crude hack for that. what? what are you gonna do anyway?

    setTimeout(() => {
        // add material icons by google
        const materialIconsLink = Object.assign(document.createElement('link'), {
            href: 'https://fonts.googleapis.com/icon?family=Material+Icons',
            rel: 'stylesheet'
        });
        document.head.appendChild(materialIconsLink);

        // find the chatfooter (where the chatbox input is)
        var chatFooter = document.getElementsByClassName("chatfooter");
        chatFooter = chatFooter[0];

        // define and add download button
        var icon = Object.assign(document.createElement('span'), {
            className: "material-icons",
            innerHTML: 'download',
            role     : "button",
            onclick  : downloadChatJson
        });
        chatFooter.prepend(icon);
    }, 1500);
}


function downloadChatJson(){
    var scrollBar = document.querySelector('#scrollBar');
    var loadingMoreMessages = false;

    // set observer to look for a scrollBar change (when new messages are loaded)
    (new MutationObserver(check)).observe(document, {childList: true, subtree: true});

    function check(changes, observer) {
        scrollBar.scrollTop = -scrollBar.scrollHeight;

        if(scrollBar) {
            loadingMoreMessages = true;

            //check if top message is a greeting. if true, stop observer and start parsing
            var messages = scrollBar.querySelectorAll('.msg-row')
            if(
                messages[messages.length - 1].querySelector('.char-msg') &&
                messages[messages.length - 1].querySelector('.flex-column').innerHTML.includes("@")
            ){
                console.log("Xabab: Reached top")
                observer.disconnect();

                setTimeout(() => {parseChatJson(scrollBar)}, 2000);


            };
        };
    };

    // trigger first load of messages
    scrollBar.scrollTop = -scrollBar.scrollHeight;

    //if not loading more messages (that's all of them) parse what we have
    setTimeout(() => {
        if(!loadingMoreMessages){
            var messages = scrollBar.querySelectorAll('.msg-row');

            if(
                !(messages[messages.length - 1].querySelector('.char-msg') &&
                  messages[messages.length - 1].querySelector('.flex-column').innerHTML.includes("@"))
            ){
                // if top message is not a greeting, something went wrong
                alert("Something went wrong! Please, try again.");
                return;
            };
            setTimeout(() => {parseChatJson(scrollBar)}, 2000);
        }
    }, 20);
}

function parseChatJson(scrollBar){
    var turndownService = new TurndownService()
    // var markdown = turndownService.turndown(messages[messages.length - 1].querySelector('.char-msg'))

    var messagesStrArr = []


    //var scrollBar = document.querySelector('#scrollBar');
    var messages = document.querySelectorAll('.msg-row')

    messages = Array.from(messages)

    messages.reverse().forEach(
        function (msg, i, listObj) {
            var author;

            //get author
            if(msg.querySelector('span').className.includes("msg-author-name")) {
                author = "You";
            }
            else {
                //console.log(msg.querySelector('span'))
                author = msg.querySelector('span').textContent.replace(/(c.AI)|(@.*)/g, '');
            }

            //get message itself
            var msgText = Array.prototype.reduce.call(msg.querySelectorAll('p'), function(html, node) {
                return html + ( node.outerHTML || node.nodeValue );
            }, "");

            //convert html to markdown, concat author and message and add to message strings array
            msgText = turndownService.turndown(msgText)
            msgText = author.concat(': ').concat(msgText)

            messagesStrArr.push(msgText)
        },
        messages
    );


    //console.log(messagesStrArr);

    //last message is always '...'
    //messagesStrArr.pop()

    var json = new Object();
    json.chat = messagesStrArr;
    //console.log(JSON.stringify(json).replace(/(",")/g, '",\n\n"'));


    var title = document.querySelector('div.chattitle');
    title.removeChild(title.querySelector('span'));
    //console.log(title)

    var blob = new Blob([JSON.stringify(json).replace(/(",")/g, '",\n\n"')], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${title.innerText} conversation.json`);

    return messagesStrArr;
}



function downloadCharacterJson(){
    var name             = document.querySelector('#name');
    var greeting         = document.querySelector('#first_prompt');
    var shortDescription = document.querySelector('#title_name');
    var longDescription  = document.querySelector('#short_description'); // but why?..
    var categories       = [];
    var exampleDialog    = document.querySelector('#definition')

    name             = name.getAttribute("value")
    greeting         = greeting.textContent
    shortDescription = shortDescription.getAttribute("value")
    longDescription  = longDescription.textContent
    for(const category of document.querySelector('.css-1hwfws3').childNodes)
        categories.push(category.textContent); categories.pop()
    exampleDialog    = exampleDialog.textContent

    console.log(name, greeting, shortDescription, longDescription, categories, exampleDialog)

    personalityTemplate = {
        "character": name,
        "personality": {
            "Traits"             : [null],
            "Mind"               : [null],
            "Tags"               : categories,
            "Mood"               : [null],
            "Gender"             : null,
            "Features"           : [null],
            "Frame"              : null,
            "Height"             : null,
            "Weight"             : null,
            "BustWaistHips"      : null,
            "FootSize"           : null,
            "Age"                : null,
            "SexualOrientation"  : null,
            "Loves"              : [null],
            "Likes"              : [null],
            "Despises"           : [null],
            "Hates"              : [null],
            "Clothes"            : [null]
        },
        "description": {
            "short" : shortDescription,
            "long"  : longDescription
        }
    }




    var personality = JSON.stringify(personalityTemplate, null, 5)

    console.log(personality)

    var json = new Object();
    json.char_name        = name;
    json.char_persona     = personality
    json.char_greeting    = greeting;
    json.world_scenario   = "";
    json.example_dialogue = exampleDialog.replaceAll(/({{char}})/g, name).replaceAll(/({{.*}})/g, "You");

    var blob = new Blob([JSON.stringify(json)], {type: "text/plain;charset=utf-8"});
    saveAs(blob, `${name} character definition.json`);

}
