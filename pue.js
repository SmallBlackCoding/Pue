
/**
 * 入口函数
 * */
(function () {
    function Pue(options) {
        this._init(options);
        console.log('--Pue---');
    }

    Pue.prototype = {
        _init:function(options){
            //缓存自己
            var self = this;
            this.data = options.data;
            this.methods = options.methods;
            //根据选择器获取对应的dom节点
            this.el=document.querySelector(options.el);
            //定义一个碎片对象
            this.fragment=null;
            //执行初始化的操作
            //遍历data的key，设置getter和setter方法
            Object.keys(this.data).forEach(function (key) {
                self.proxyKeys(key);
            });
            this.observer(this.data);
            // new Compile(options.el,this);
            this.initCompile();

        },
        //在原型对象上设置属性和方法
        proxyKeys: function (key) {
            var self = this;
            // console.log(self);
            Object.defineProperty(this, key, {
                    enumerable: false,
                    configurable:true,
                    get:function getter() {
                        return self.data[key];
                    },
                    set:function setter(newVal) {
                        self.data[key]=newVal;
                    }
                }
            )
        },

        /**
         * Observer
         * */

        observer:function (value) {
            //如果不是对象的话就不需要继续设置set和get方法
            if(!value||typeof value!=='object'){
                return;
            }
            return this.executeObserver(value);
        },
        executeObserver: function (data) {
            //  this.data = data;
            this.walk(data);
        },

        walk: function (data) {
            var self = this;
            Object.keys(data).forEach(function (key) {
                self.defineReactive(data, key, data[key]);
            })
        },
        defineReactive:function (data,key,val) {
            //创建一个订阅者管理器的对象
            var dep=new Dep();
            this.observer(val);
            Object.defineProperty(data,key,{
                enumerable:true,
                configurable:true,
                get:function getter() {
                    if(Dep.target){
                        dep.addSub(Dep.target);
                    }
                    return val;
                },
                set:function setter(newVal) {
                    //如果新设置的值跟之前的值是相等的，则不需要
                    if(newVal===val){
                        return;
                    }
                    //把val重新赋值
                    val=newVal;
                    //根据为该值注册的订阅者更新对应的视图
                    dep.notify();
                }
            });

        },


        /**
         * Compile
         * */
        initCompile:function() {
            if(this.el){
                //把node转化为fragment节省内容开销
                this.fragment=this.nodeToFragment(this.el);
                this.compileElement(this.fragment);
                this.el.appendChild(this.fragment);
            }
            else{
                console.log('DOM元素不存在');
            }
        },
        nodeToFragment:function (el) {
            //节省内存开销
            var fragment=document.createDocumentFragment();
            var child=el.firstChild;
            //将dom元素移入fragment中
            while(child){
                fragment.appendChild(child);
                child=el.firstChild;
            }
            return fragment;
        },
        compileElement:function (fragment) {
            var childNodes=fragment.childNodes;
            //缓存自己
            var self=this;
            //遍历所有的节点，找到既是文本节点同时符合正则表达式的节点
            [].slice.call(childNodes).forEach(function (node) {
                var reg=/\{\{(.*)\}\}/;
                //获取该node里面的文本
                var text=node.textContent;
                //判断给节点是否是元素节点
                if(self.isElementNode(node)){
                    //如果是元素节点
                    self.compile(node);
                }
                else if(self.isTextNode(node)&&reg.test(text)){
                    //compileText
                    self.compileText(node,reg.exec(text)[1]);
                }
                if(node.childNodes&&node.childNodes.length){
                    //如果该节点还有子节点的话继续遍历，执行同一个方法
                    self.compileElement(node);
                }
            });
        },
        compile:function (node) {
            //获取该节点的属性
            var nodeAttrs=node.attributes;
            var self=this;
            //遍历元素节点的属性集合
            Array.prototype.forEach.call(nodeAttrs,function (attr) {
                var attrName=attr.name;
                if(self.isDirective(attrName)){
                    //把属性的value赋值给exp
                    var exp=attr.value;
                    //str.substring 从第二位开始截取字符串，包含第二位
                    var dir=attrName.substring(2);
                    //判断是否是事件指令
                    if(self.isEventDirective(dir)){
                        //编译事件

                        self.compileEvent(node,self,exp,dir);
                    }else{
                        //编译model
                        self.compileModel(node,self,exp)
                    }
                    //移除这个属性
                    node.removeAttribute(attrName);
                }
            })
        },

//编译事件
        compileEvent:function (node,pue,exp,dir) {
            console.log('----compileEvent---');
            //获取事件的类型 对字符串进行截取处理 v-on:click
            var evenType=dir.split(':')[1];//click
            console.log(evenType);
            console.log(exp);
            var callback=pue.methods&&pue.methods[exp];//exp为方法名 也就是属性 v-on:click "clickMe"
            console.log(callback);
            if(evenType &&callback){
                node.addEventListener(evenType,callback.bind(pue),false);
            }
        },
//编译数据绑定的model
        compileModel:function (node,pue,exp) {
            console.log('----compileModel---');
            var self=this;
            var val=self[exp];
            console.log('val',val);
            console.log('exp',exp);
            //初始化 第一个把值设置到dom元素的文本节点中
            this.modelUpdater(node,val);
            //创建观察者，添加到被观察者身上
            new Watcher(self,exp,function (value) {
                self.modelUpdater(node,value);
            });
            node.addEventListener('input',function (e) {
                //获取输入的内容
                var newValue=e.target.value;
                if(val===newValue){
                    return;
                }
                //更新对应的值，触发订阅器的notify方法，更新对应的dom节点的textContent
                //每次改变obj.key,会自动触发obj.setKey(newKey)
                self[exp]=newValue;
                val=newValue;
            })
        },
//编译文本
        compileText:function (node,exp) {
            var self=this;
            var initText=self[exp];
            this.updateText(node,initText);
            new Watcher(self,exp,function (value) {
                self.updateText(node,value);
            });
        },

//判断是否是指令 directive 指令
        isDirective:function (attr) {
            return attr.indexOf('p-')==0;
        },
//判断是否是事件指令
        isEventDirective:function (dir) {
            return dir.indexOf('on:')===0;
        },
        updateText:function (node,value) {
            node.textContent=typeof value=='undefined'?'':value;
        },

//数据绑定更新器 input等标签 的value
        modelUpdater:function (node,value) {
            node.value=typeof value=='undefined'?'':value;
        },


//判断该节点是否为元素节点
        isElementNode:function (node) {
            return node.nodeType==1;
        },
//判断该节点是否为文本节点
        isTextNode:function (node) {
            return node.nodeType==3;
        }

    };


    /**
     * 观察者对象
     * */
    function Watcher(pue,exp,callback) {
        //传入pue对象，以便获取到data的数据
        this.pue=pue;
        //传入改变的key
        this.exp=exp;
        //回调函数，把改变了的value传给updateText方法，改变dom节点的内容
        this.callback=callback;
        //获取改变之前的val的值。手动触发对应val的get方法，把自己添加到订阅器的操作
        this.value=this.get();
    }

    Watcher.prototype={
        update:function () {
            //观察者更新自己的方法，每一个value需要注册一个观察者
            this.run();
        },
        run:function () {
            //获取到最新的val（改变后的val）
            var value=this.pue.data[this.exp];
            var oldVal=this.value;
            //如果新的val跟老的val不一样，就执行跟新dom节点的回调函数
            if(value!==oldVal){
                //把最新的val赋值给老的val
                this.value=value;
                this.callback.call(this.pue,value,oldVal);
            }
        },
        get:function () {
            //把当前的观察者放进一个临时变量里面，方便val去注册他
            Dep.target=this;
            //强制执行监听器里面的get函数，把当前的watcher注册到对应的val
            var value=this.pue.data[this.exp];
            //再把临时变量置空，方便下一个watcher缓存自己
            Dep.target=null;
            return value;
        }
    };


    /**
     * 创建一个订阅者对象管理器
     * */
    function Dep() {
        this.subs=[];
    }
    Dep.prototype={
        addSub:function (sub) {
            this.subs.push(sub);
        },
        notify:function () {
            this.subs.forEach(function (sub) {
                //所有的被观察者都是有一个update的方法
                sub.update();
            })
        }
    };
    Dep.target=null;
    window.Pue=Pue;
})(window);

